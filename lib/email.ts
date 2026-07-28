import nodemailer from "nodemailer";
import { getAppUrl } from "./env";
import { escapeHtml } from "./security";

type EmailDelivery = {
  sent: boolean;
  url: string;
  provider: "smtp" | "resend" | "manual";
};

type EmailMessage = {
  to: string;
  subject: string;
  html: string;
};

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(readSmtpConfiguration() || readResendConfiguration());
}

export async function sendInvitationEmail(input: {
  email: string;
  fullName: string;
  token: string;
  origin?: string;
}): Promise<{ sent: boolean; inviteUrl: string; provider: EmailDelivery["provider"] }> {
  const inviteUrl = `${getAppUrl(input.origin)}/?invite=${encodeURIComponent(input.token)}`;
  const delivery = await deliverEmail(
    {
      to: input.email,
      subject: "Invitación a Movilidad y Transporte",
      html: emailLayout({
        eyebrow: "Gobierno de Morelos · Movilidad y Transporte",
        title: "Activa tu cuenta",
        greeting: `Hola ${escapeHtml(input.fullName)},`,
        body: "Recibiste acceso a la plataforma de Movilidad y Transporte.",
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
}): Promise<{ sent: boolean; resetUrl: string; provider: EmailDelivery["provider"] }> {
  const resetUrl = `${getAppUrl(input.origin)}/?reset=${encodeURIComponent(input.token)}`;
  const delivery = await deliverEmail(
    {
      to: input.email,
      subject: "Restablece tu contraseña de Movilidad y Transporte",
      html: emailLayout({
        eyebrow: "Gobierno de Morelos · Movilidad y Transporte",
        title: "Restablece tu contraseña",
        greeting: `Hola ${escapeHtml(input.fullName)},`,
        body: "Se solicitó un cambio de contraseña para tu cuenta.",
        actionUrl: resetUrl,
        actionLabel: "Cambiar contraseña",
        expiration: "Este enlace es personal, funciona una sola vez y vence en 60 minutos. Si no solicitaste el cambio, ignora este correo.",
      }),
    },
    resetUrl,
  );
  return { sent: delivery.sent, resetUrl, provider: delivery.provider };
}

async function deliverEmail(message: EmailMessage, url: string): Promise<EmailDelivery> {
  const smtp = readSmtpConfiguration();
  if (smtp) {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      requireTLS: smtp.requireTls,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      tls: {
        minVersion: "TLSv1.2",
        rejectUnauthorized: true,
      },
    });
    const result = await transporter.sendMail({
      from: smtp.from,
      replyTo: smtp.replyTo,
      to: message.to,
      subject: message.subject,
      html: message.html,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    if (!result.accepted.length) {
      throw new Error("El servidor SMTP no aceptó al destinatario.");
    }
    return { sent: true, url, provider: "smtp" };
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
      throw new Error("El proveedor de correo rechazó el mensaje.");
    }
    return { sent: true, url, provider: "resend" };
  }

  return { sent: false, url, provider: "manual" };
}

function readSmtpConfiguration(): {
  host: string;
  port: number;
  secure: boolean;
  requireTls: boolean;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
} | null {
  const host = clean(process.env.SMTP_HOST);
  const portValue = clean(process.env.SMTP_PORT);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS);
  const hasAnySmtpValue = Boolean(host || portValue || user || pass);
  if (!hasAnySmtpValue) return null;

  if (!host || !portValue || !user || !pass) {
    throw new Error("La configuración SMTP está incompleta. Revisa SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS.");
  }
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT debe ser un puerto válido.");
  }

  const secure = readBoolean("SMTP_SECURE", port === 465);
  return {
    host,
    port,
    secure,
    requireTls: secure ? false : readBoolean("SMTP_REQUIRE_TLS", true),
    user,
    pass,
    from: clean(process.env.EMAIL_FROM) || `Movilidad y Transporte <${user}>`,
    replyTo: clean(process.env.EMAIL_REPLY_TO) || undefined,
  };
}

function readResendConfiguration(): { apiKey: string; from: string } | null {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const from = clean(process.env.EMAIL_FROM);
  const hasPlaceholder = /REEMPLAZAR|tu-dominio/i.test(`${apiKey ?? ""} ${from ?? ""}`);
  return apiKey && from && !hasPlaceholder ? { apiKey, from } : null;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = clean(process.env[name]);
  if (!value) return fallback;
  if (/^(true|1|yes|si|sí)$/i.test(value)) return true;
  if (/^(false|0|no)$/i.test(value)) return false;
  throw new Error(`${name} debe tener un valor verdadero o falso.`);
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
