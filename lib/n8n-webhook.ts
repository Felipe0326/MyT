import "server-only";

export type N8nDashboard = string;

type WebhookDefinition = {
  url: string | undefined;
  secret: string | undefined;
};

export type N8nWebhookResult = {
  message: string | null;
  recordsProcessed: number | null;
  updatedAt: string;
};

export class N8nWebhookConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "N8nWebhookConfigurationError";
  }
}

export class N8nWebhookRequestError extends Error {
  constructor(
    message: string,
    public readonly kind: "timeout" | "network" | "response",
    public readonly upstreamStatus: number | null = null,
  ) {
    super(message);
    this.name = "N8nWebhookRequestError";
  }
}

const WEBHOOK_TIMEOUT_MS = 45_000;
const MAX_RESPONSE_BYTES = 32 * 1024;

export async function triggerN8nWebhook(
  dashboard: N8nDashboard,
  requestedBy: string,
): Promise<N8nWebhookResult> {
  const definition = getWebhookDefinition(dashboard);
  const webhookUrl = validateWebhookUrl(definition.url);
  const requireAuthentication = process.env.N8N_WEBHOOK_AUTH_REQUIRED?.trim().toLowerCase() === "true";

  if (requireAuthentication && !definition.secret) {
    throw new N8nWebhookConfigurationError(
      `Falta el secreto privado del webhook de ${dashboard}.`,
    );
  }

  const headers = new Headers({
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
  });
  if (definition.secret) {
    headers.set("X-Webhook-Secret", definition.secret);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "sistema-movilidad-tym",
        dashboard,
        trigger: "manual",
        requestedAt: new Date().toISOString(),
        requestedBy,
      }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
    });

    const responseBody = await readLimitedResponse(response, MAX_RESPONSE_BYTES);
    if (!response.ok) {
      throw new N8nWebhookRequestError(
        "El servicio de actualización rechazó la solicitud.",
        "response",
        response.status,
      );
    }

    return parseWorkflowResult(responseBody);
  } catch (error) {
    if (error instanceof N8nWebhookRequestError) throw error;
    if ((error as Error).name === "AbortError") {
      throw new N8nWebhookRequestError(
        "La actualización tardó demasiado.",
        "timeout",
      );
    }
    throw new N8nWebhookRequestError(
      "No fue posible comunicarse con el servicio de actualización.",
      "network",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function getWebhookDefinition(dashboard: N8nDashboard): WebhookDefinition {
  if (!/^[a-z0-9-]+$/.test(dashboard)) {
    throw new N8nWebhookConfigurationError("El identificador del tablero no es válido.");
  }

  const prefix = dashboard.toUpperCase().replaceAll("-", "_");
  const commonSecret = process.env.N8N_WEBHOOK_SECRET?.trim();
  return {
    url: process.env[`N8N_${prefix}_WEBHOOK_URL`]?.trim(),
    secret: process.env[`N8N_${prefix}_WEBHOOK_SECRET`]?.trim() || commonSecret,
  };
}

function validateWebhookUrl(configured: string | undefined): URL {
  if (!configured) {
    throw new N8nWebhookConfigurationError("No se configuró la URL privada del webhook.");
  }

  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new N8nWebhookConfigurationError("La URL privada del webhook no es válida.");
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.hash ||
    !parsed.hostname ||
    !parsed.pathname.startsWith("/webhook/")
  ) {
    throw new N8nWebhookConfigurationError(
      "El webhook debe usar HTTPS y una ruta /webhook/ válida.",
    );
  }

  const allowedHosts = process.env.N8N_WEBHOOK_ALLOWED_HOSTS
    ?.split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (allowedHosts?.length && !allowedHosts.includes(parsed.hostname.toLowerCase())) {
    throw new N8nWebhookConfigurationError("El host del webhook no está autorizado.");
  }

  return parsed;
}

async function readLimitedResponse(response: Response, maximumBytes: number): Promise<string> {
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new N8nWebhookRequestError(
        "La respuesta del servicio excedió el tamaño permitido.",
        "response",
        response.status,
      );
    }
    chunks.push(value);
  }

  const payload = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(payload);
}

function parseWorkflowResult(responseBody: string): N8nWebhookResult {
  const fallback: N8nWebhookResult = {
    message: null,
    recordsProcessed: null,
    updatedAt: new Date().toISOString(),
  };
  if (!responseBody.trim()) return fallback;

  try {
    const parsed = JSON.parse(responseBody) as {
      mensaje?: unknown;
      message?: unknown;
      registrosProcesados?: unknown;
      recordsProcessed?: unknown;
      actualizadoEn?: unknown;
      updatedAt?: unknown;
    };
    const rawMessage = parsed.mensaje ?? parsed.message;
    const rawRecords = parsed.registrosProcesados ?? parsed.recordsProcessed;
    const rawUpdatedAt = parsed.actualizadoEn ?? parsed.updatedAt;
    const recordsProcessed = Number(rawRecords);

    return {
      message: typeof rawMessage === "string" && rawMessage.trim() ? rawMessage.trim() : null,
      recordsProcessed: Number.isFinite(recordsProcessed) ? recordsProcessed : null,
      updatedAt:
        typeof rawUpdatedAt === "string" && rawUpdatedAt.trim()
          ? rawUpdatedAt.trim()
          : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}
