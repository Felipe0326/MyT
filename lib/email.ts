import nodemailer from "nodemailer";
import { getAppUrl } from "./env";
import { escapeHtml } from "./security";
import { serviceRest } from "./supabase";

type EmailProvider = "smtp" | "resend" | "manual";
type EmailCategory = "invitation" | "password_reset";
type SmtpAttemptName = "primary-587" | "fallback-465";

type EmailDelivery = {
  sent: boolean;
  url: string;
  provider: EmailProvider;
  messageId?: string;
  smtpCode?: number;
  smtpResponse?: string;
  usedFallback?: boolean;
};

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  category: EmailCategory;
};

type SmtpConfiguration = {
  host: string;
  primaryPort: number;
  fallbackPort: number;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  bounceTo: string;
  authMethod?: "LOGIN" | "PLAIN";
};

type SmtpAttempt = {
  name: SmtpAttemptName;
  port: number;
  secure: boolean;
  requireTls: boolean;
};

type SmtpErrorDetails = {
  code?: string;
  responseCode?: number;
  response?: string;
  command?: string;
  syscall?: string;
  address?: string;
  port?: number;
  message: string;
};

const CONNECTION_ERROR_CODES = new Set([
  "ECONNECTION",
  "ETIMEDOUT",
  "ESOCKET",
  "ETLS",
  "EDNS",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EAI_AGAIN",
  "ENOTFOUND",
  "EPROTO",
]);

const CONNECTION_COMMANDS = new Set(["CONN", "EHLO", "HELO", "STARTTLS"]);

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(readSmtpConfiguration() || readResendConfiguration());
}

export async function sendInvitationEmail(input: {
  email: string;
  fullName: string;
  token: string;
  origin?: string;
}): Promise<{ sent: boolean; inviteUrl: string; provider: EmailProvider }> {
  const inviteUrl = `${getAppUrl(input.origin)}/?invite=${encodeURIComponent(input.token)}`;
  const delivery = await deliverEmail(
    {
      to: input.email,
      subject: "Activa tu cuenta",
      category: "invitation",
      html: emailLayout({
        eyebrow: "Agencia de Transformación Digital",
        title: "Activa tu cuenta",
        greeting: `Hola ${escapeHtml(input.fullName)},`,
        body: "Recibiste acceso al Sistema de Consulta de Información de Trámites, Refrendos y Experiencia Ciudadana NPS.",
        actionUrl: inviteUrl,
        actionLabel: "Crear contraseña",
        expiration: "Este enlace es personal, funciona una sola vez y vence en 48 horas.",
      }),
    },
    inviteUrl,
  );

  return { sent: delivery.sent, inviteUrl, provider: delivery.provider };
}

export async function sendPasswordResetEmail(input: {
  email: string;
  fullName: string;
  token: string;
  origin?: string;
}): Promise<{ sent: boolean; resetUrl: string; provider: EmailProvider }> {
  const resetUrl = `${getAppUrl(input.origin)}/?reset=${encodeURIComponent(input.token)}`;
  const delivery = await deliverEmail(
    {
      to: input.email,
      subject: "Restablece tu contraseña",
      category: "password_reset",
      html: emailLayout({
        eyebrow: "Agencia de Transformación Digital",
        title: "Restablece tu contraseña",
        greeting: `Hola ${escapeHtml(input.fullName)},`,
        body: "Recibiste una solicitud para restablecer tu contraseña del Sistema de Consulta de Información de Trámites, Refrendos y Experiencia Ciudadana NPS.",
        actionUrl: resetUrl,
        actionLabel: "Cambiar contraseña",
        expiration:
          "Este enlace es personal, funciona una sola vez y vence en 60 minutos. Si no solicitaste el cambio, ignora este correo.",
      }),
    },
    resetUrl,
  );

  return { sent: delivery.sent, resetUrl, provider: delivery.provider };
}

async function deliverEmail(message: EmailMessage, url: string): Promise<EmailDelivery> {
  const smtp = readSmtpConfiguration();
  if (smtp) {
    return deliverWithSmtp(message, url, smtp);
  }

  const resend = readResendConfiguration();
  if (resend) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resend.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: resend.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text();
      await recordEmailDelivery({
        category: message.category,
        recipient: message.to,
        provider: "resend",
        success: false,
        smtpResponse: responseBody.slice(0, 2_000),
        errorCode: `HTTP_${response.status}`,
        errorMessage: "El proveedor de correo rechazó el mensaje.",
        finalAttempt: true,
      });
      throw new Error("El proveedor de correo rechazó el mensaje.");
    }

    const payload = (await response.json().catch(() => null)) as { id?: string } | null;
    await recordEmailDelivery({
      category: message.category,
      recipient: message.to,
      provider: "resend",
      success: true,
      messageId: payload?.id,
      finalAttempt: true,
    });

    return { sent: true, url, provider: "resend", messageId: payload?.id };
  }

  await recordEmailDelivery({
    category: message.category,
    recipient: message.to,
    provider: "manual",
    success: false,
    errorCode: "EMAIL_NOT_CONFIGURED",
    errorMessage: "No hay un proveedor de correo configurado.",
    finalAttempt: true,
  });

  return { sent: false, url, provider: "manual" };
}

async function deliverWithSmtp(
  message: EmailMessage,
  url: string,
  smtp: SmtpConfiguration,
): Promise<EmailDelivery> {
  const primary: SmtpAttempt = {
    name: "primary-587",
    port: smtp.primaryPort,
    secure: false,
    requireTls: true,
  };
  const fallback: SmtpAttempt = {
    name: "fallback-465",
    port: smtp.fallbackPort,
    secure: true,
    requireTls: false,
  };

  try {
    const delivery = await sendSmtpAttempt(message, smtp, primary, false);
    return { ...delivery, url, provider: "smtp", usedFallback: false };
  } catch (primaryError) {
    const primaryDetails = getSmtpErrorDetails(primaryError);
    const shouldTryFallback =
      smtp.fallbackPort !== smtp.primaryPort && isRetryableConnectionError(primaryDetails);

    await recordEmailDelivery({
      category: message.category,
      recipient: message.to,
      provider: "smtp",
      host: smtp.host,
      port: primary.port,
      secure: primary.secure,
      attemptName: primary.name,
      usedFallback: false,
      success: false,
      smtpCode: primaryDetails.responseCode,
      smtpResponse: primaryDetails.response,
      errorCode: primaryDetails.code,
      errorMessage: primaryDetails.message,
      finalAttempt: !shouldTryFallback,
    });

    logSmtpFailure(message, smtp, primary, primaryDetails, !shouldTryFallback);

    if (!shouldTryFallback) {
      throw createPublicSmtpError(primaryDetails);
    }

    try {
      const delivery = await sendSmtpAttempt(message, smtp, fallback, true);
      return { ...delivery, url, provider: "smtp", usedFallback: true };
    } catch (fallbackError) {
      const fallbackDetails = getSmtpErrorDetails(fallbackError);

      await recordEmailDelivery({
        category: message.category,
        recipient: message.to,
        provider: "smtp",
        host: smtp.host,
        port: fallback.port,
        secure: fallback.secure,
        attemptName: fallback.name,
        usedFallback: true,
        success: false,
        smtpCode: fallbackDetails.responseCode,
        smtpResponse: fallbackDetails.response,
        errorCode: fallbackDetails.code,
        errorMessage: fallbackDetails.message,
        finalAttempt: true,
      });

      logSmtpFailure(message, smtp, fallback, fallbackDetails, true);
      throw createPublicSmtpError(fallbackDetails);
    }
  }
}

async function sendSmtpAttempt(
  message: EmailMessage,
  smtp: SmtpConfiguration,
  attempt: SmtpAttempt,
  usedFallback: boolean,
): Promise<Omit<EmailDelivery, "url" | "provider">> {
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: attempt.port,
    secure: attempt.secure,
    requireTLS: attempt.requireTls,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    ...(smtp.authMethod ? { authMethod: smtp.authMethod } : {}),
    connectionTimeout: 12_000,
    greetingTimeout: 12_000,
    socketTimeout: 30_000,
    tls: {
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: smtp.host,
    },
  });

  try {
    const result = await transporter.sendMail({
      from: smtp.from,
      replyTo: smtp.replyTo,
      to: message.to,
      envelope: {
        from: smtp.bounceTo,
        to: message.to,
      },
      subject: message.subject,
      html: message.html,
      disableFileAccess: true,
      disableUrlAccess: true,
    });

    const accepted = normalizeAddressList(result.accepted);
    const rejected = normalizeAddressList(result.rejected);
    const smtpResponse = clean(result.response);
    const smtpCode = parseSmtpCode(smtpResponse);

    if (!accepted.length) {
      const error = new Error("El servidor SMTP no aceptó al destinatario.") as Error & {
        code?: string;
        response?: string;
        responseCode?: number;
        command?: string;
      };
      error.code = "EENVELOPE";
      error.response = smtpResponse;
      error.responseCode = smtpCode;
      error.command = "RCPT TO";
      throw error;
    }

    await recordEmailDelivery({
      category: message.category,
      recipient: message.to,
      provider: "smtp",
      host: smtp.host,
      port: attempt.port,
      secure: attempt.secure,
      attemptName: attempt.name,
      usedFallback,
      success: true,
      smtpCode,
      smtpResponse,
      messageId: result.messageId,
      accepted,
      rejected,
      finalAttempt: true,
    });

    console.info("SMTP delivery accepted.", {
      category: message.category,
      recipient: maskEmail(message.to),
      host: smtp.host,
      port: attempt.port,
      secure: attempt.secure,
      attempt: attempt.name,
      usedFallback,
      smtpCode,
      smtpResponse,
      messageId: result.messageId,
      accepted: accepted.map(maskEmail),
      rejected: rejected.map(maskEmail),
    });

    return {
      sent: true,
      messageId: result.messageId,
      smtpCode,
      smtpResponse,
      usedFallback,
    };
  } finally {
    transporter.close();
  }
}

function readSmtpConfiguration(): SmtpConfiguration | null {
  const host = clean(process.env.SMTP_HOST);
  const user = clean(process.env.SMTP_USER).toLowerCase();
  const pass = clean(process.env.SMTP_PASS);
  const primaryPortValue = clean(process.env.SMTP_PORT);
  const fallbackPortValue = clean(process.env.SMTP_FALLBACK_PORT);
  const hasAnySmtpValue = Boolean(host || pass || primaryPortValue || fallbackPortValue);

  if (!hasAnySmtpValue) return null;

  if (!host || !user || !pass) {
    throw new Error("La configuración SMTP está incompleta. Revisa SMTP_HOST, SMTP_USER y SMTP_PASS.");
  }

  const primaryPort = readPort(primaryPortValue || "587", "SMTP_PORT");
  const fallbackPort = readPort(fallbackPortValue || "465", "SMTP_FALLBACK_PORT");
  const from = clean(process.env.EMAIL_FROM) || user;
  const fromAddress = extractMailbox(from);

  if (!fromAddress || fromAddress.toLowerCase() !== user) {
    throw new Error("EMAIL_FROM debe utilizar la misma cuenta definida en SMTP_USER.");
  }

  const bounceTo = clean(process.env.SMTP_BOUNCE_TO) || user;
  if (!isEmailAddress(bounceTo)) {
    throw new Error("SMTP_BOUNCE_TO debe contener una dirección de correo válida.");
  }

  const replyTo = clean(process.env.EMAIL_REPLY_TO);
  if (replyTo && !isEmailAddress(replyTo)) {
    throw new Error("EMAIL_REPLY_TO debe contener una dirección de correo válida.");
  }

  const authMethodValue = clean(process.env.SMTP_AUTH_METHOD).toUpperCase();
  if (authMethodValue && authMethodValue !== "LOGIN" && authMethodValue !== "PLAIN") {
    throw new Error("SMTP_AUTH_METHOD solamente puede ser LOGIN o PLAIN.");
  }

  return {
    host,
    primaryPort,
    fallbackPort,
    user,
    pass,
    from,
    replyTo: replyTo || undefined,
    bounceTo,
    authMethod: authMethodValue
      ? (authMethodValue as SmtpConfiguration["authMethod"])
      : undefined,
  };
}

function readResendConfiguration(): { apiKey: string; from: string } | null {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.EMAIL_FROM);
  const hasPlaceholder = /REEMPLAZAR|tu-dominio/i.test(`${apiKey} ${from}`);
  return apiKey && from && !hasPlaceholder ? { apiKey, from } : null;
}

function readPort(value: string, variableName: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${variableName} debe ser un puerto válido.`);
  }
  return port;
}

function isRetryableConnectionError(error: SmtpErrorDetails): boolean {
  if (error.code && CONNECTION_ERROR_CODES.has(error.code.toUpperCase())) return true;
  if (error.command && CONNECTION_COMMANDS.has(error.command.toUpperCase())) return true;

  // 421 puede indicar que el servidor cerró temporalmente la conexión antes del envío.
  return error.responseCode === 421 && !/RCPT|DATA|MESSAGE/i.test(error.command ?? "");
}

function getSmtpErrorDetails(error: unknown): SmtpErrorDetails {
  const value = error as {
    code?: unknown;
    responseCode?: unknown;
    response?: unknown;
    command?: unknown;
    syscall?: unknown;
    address?: unknown;
    port?: unknown;
    message?: unknown;
  };

  return {
    code: typeof value?.code === "string" ? value.code : undefined,
    responseCode:
      typeof value?.responseCode === "number"
        ? value.responseCode
        : parseSmtpCode(typeof value?.response === "string" ? value.response : ""),
    response: typeof value?.response === "string" ? value.response : undefined,
    command: typeof value?.command === "string" ? value.command : undefined,
    syscall: typeof value?.syscall === "string" ? value.syscall : undefined,
    address: typeof value?.address === "string" ? value.address : undefined,
    port: typeof value?.port === "number" ? value.port : undefined,
    message:
      typeof value?.message === "string" && value.message.trim()
        ? value.message
        : "No fue posible establecer la comunicación con el servidor SMTP.",
  };
}

function createPublicSmtpError(details: SmtpErrorDetails): Error {
  if (details.responseCode && details.responseCode >= 500) {
    return new Error(`El servidor SMTP rechazó el correo (${details.responseCode}).`);
  }
  if (details.responseCode && details.responseCode >= 400) {
    return new Error(`El servidor SMTP reportó un error temporal (${details.responseCode}).`);
  }
  if (details.code === "EAUTH") {
    return new Error("El servidor SMTP rechazó el usuario o el App Password.");
  }
  return new Error("No fue posible conectar con el servidor SMTP por los puertos 587 ni 465.");
}

function logSmtpFailure(
  message: EmailMessage,
  smtp: SmtpConfiguration,
  attempt: SmtpAttempt,
  error: SmtpErrorDetails,
  finalAttempt: boolean,
): void {
  console.error("SMTP delivery failed.", {
    category: message.category,
    recipient: maskEmail(message.to),
    host: smtp.host,
    port: attempt.port,
    secure: attempt.secure,
    attempt: attempt.name,
    finalAttempt,
    smtpCode: error.responseCode,
    smtpResponse: error.response,
    errorCode: error.code,
    command: error.command,
    syscall: error.syscall,
    address: error.address,
    connectionPort: error.port,
    message: error.message,
  });
}

type DeliveryLogInput = {
  category: EmailCategory;
  recipient: string;
  provider: EmailProvider;
  host?: string;
  port?: number;
  secure?: boolean;
  attemptName?: SmtpAttemptName;
  usedFallback?: boolean;
  success: boolean;
  smtpCode?: number;
  smtpResponse?: string;
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
  errorCode?: string;
  errorMessage?: string;
  finalAttempt: boolean;
};

async function recordEmailDelivery(input: DeliveryLogInput): Promise<void> {
  try {
    const response = await serviceRest("email_delivery_logs_tym", {
      method: "POST",
      body: {
        category: input.category,
        recipient: input.recipient.trim().toLowerCase(),
        provider: input.provider,
        smtp_host: input.host ?? null,
        smtp_port: input.port ?? null,
        smtp_secure: input.secure ?? null,
        attempt_name: input.attemptName ?? null,
        used_fallback: input.usedFallback ?? false,
        success: input.success,
        smtp_code: input.smtpCode ?? null,
        smtp_response: input.smtpResponse?.slice(0, 2_000) ?? null,
        message_id: input.messageId ?? null,
        accepted: input.accepted ?? [],
        rejected: input.rejected ?? [],
        error_code: input.errorCode ?? null,
        error_message: input.errorMessage?.slice(0, 2_000) ?? null,
        final_attempt: input.finalAttempt,
      },
    });

    if (!response.ok) {
      console.warn("No fue posible guardar el registro de entrega de correo.", {
        status: response.status,
      });
    }
  } catch (error) {
    // El envío no debe marcarse como fallido únicamente porque el registro de auditoría no se pudo guardar.
    console.warn("No fue posible guardar el registro de entrega de correo.", {
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

function parseSmtpCode(response: string): number | undefined {
  const match = response.match(/(?:^|\s)([245]\d{2})(?:\s|-|$)/);
  return match ? Number(match[1]) : undefined;
}

function normalizeAddressList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object" && "address" in value) {
        const address = (value as { address?: unknown }).address;
        return typeof address === "string" ? address : "";
      }
      return String(value ?? "");
    })
    .map((value) => value.trim())
    .filter(Boolean);
}

function extractMailbox(value: string): string | null {
  const bracketMatch = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/);
  if (bracketMatch) return bracketMatch[1];
  return isEmailAddress(value) ? value : null;
}

function isEmailAddress(value: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim());
}

function maskEmail(value: string): string {
  const [localPart, domain] = value.trim().split("@");
  if (!localPart || !domain) return "***";
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"*".repeat(Math.max(1, localPart.length - visible.length))}@${domain}`;
}

function clean(value: string | undefined): string {
  return value?.trim() ?? "";
}

function emailLayout(input: {
  eyebrow: string;
  title: string;
  greeting: string;
  body: string;
  actionUrl: string;
  actionLabel: string;
  expiration: string;
}): string {
  return `
    <div style="font-family:Arial,sans-serif;color:#242923;line-height:1.6;max-width:600px;margin:auto">
      <p style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#667364">${escapeHtml(input.eyebrow)}</p>
      <h1 style="font-size:24px;color:#563039">${escapeHtml(input.title)}</h1>
      <p>${input.greeting}</p>
      <p>${escapeHtml(input.body)}</p>
      <p><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#5b744f;color:white;text-decoration:none;padding:12px 20px;border-radius:8px">${escapeHtml(input.actionLabel)}</a></p>
      <p style="font-size:13px;color:#687169">${escapeHtml(input.expiration)}</p>
    </div>`;
}
