import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimits,
  RateLimitUnavailableError,
  rateLimitResponse,
  rateLimitUnavailableResponse,
} from "../../../../lib/rate-limit";
import { verifyMutationOrigin } from "../../../../lib/request-security";
import { verifyCsrf } from "../../../../lib/security";
import { authenticateRequest, clearSessionCookies } from "../../../../lib/session";

const DEFAULT_NPS_WEBHOOK_URL = "https://lowcode.morelos.gob.mx/webhook/actualizar_nps";
const WEBHOOK_TIMEOUT_MS = 45_000;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!verifyMutationOrigin(request)) {
    return jsonError("Origen de solicitud no autorizado.", 403);
  }
  if (!verifyCsrf(request)) {
    return jsonError("Solicitud no autorizada.", 403);
  }

  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    const response = jsonError(auth.message, auth.status);
    if (auth.clearCookies) clearSessionCookies(response);
    return response;
  }

  const permission = auth.context.sections.find(
    (section) => section.slug === "dashboard-nps" && section.can_view,
  );
  if (!permission) {
    return jsonError("No tienes permiso para actualizar el tablero NPS.", 403);
  }

  try {
    const rateLimit = await consumeRateLimits([
      {
        scope: "nps:manual-refresh:actor",
        identifier: auth.context.user.id,
        limit: 12,
        windowSeconds: 60 * 60,
        blockSeconds: 10 * 60,
      },
    ]);
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  let webhookUrl: string;
  try {
    webhookUrl = getNpsWebhookUrl();
  } catch (error) {
    console.error("[nps-refresh] URL de webhook inválida.", error);
    return jsonError("La actualización de NPS no está configurada correctamente.", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const webhookResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "sistema-movilidad-tym",
        trigger: "manual",
        requestedAt: new Date().toISOString(),
        requestedBy: auth.context.user.id,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const responseBody = await webhookResponse.text().catch(() => "");
    if (!webhookResponse.ok) {
      console.error(
        `[nps-refresh] n8n respondió ${webhookResponse.status}: ${responseBody.slice(0, 500)}`,
      );
      return jsonError(
        "n8n recibió la solicitud, pero no pudo completar la actualización de NPS.",
        502,
      );
    }

    const workflowResult = parseWorkflowResult(responseBody);
    return NextResponse.json(
      {
        ok: true,
        message: workflowResult.message,
        recordsProcessed: workflowResult.recordsProcessed,
        updatedAt: workflowResult.updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return jsonError("La actualización de NPS tardó demasiado. Inténtalo nuevamente.", 504);
    }

    console.error("[nps-refresh] No fue posible ejecutar el webhook de n8n.", error);
    return jsonError("No fue posible comunicarse con el flujo de actualización de NPS.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function parseWorkflowResult(responseBody: string): {
  message: string;
  recordsProcessed: number | null;
  updatedAt: string;
} {
  const fallback = {
    message: "La información de NPS se actualizó correctamente.",
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
      message: typeof rawMessage === "string" && rawMessage.trim()
        ? rawMessage.trim()
        : fallback.message,
      recordsProcessed: Number.isFinite(recordsProcessed) ? recordsProcessed : null,
      updatedAt: typeof rawUpdatedAt === "string" && rawUpdatedAt.trim()
        ? rawUpdatedAt.trim()
        : fallback.updatedAt,
    };
  } catch {
    return fallback;
  }
}

function getNpsWebhookUrl(): string {
  const configured = process.env.N8N_NPS_WEBHOOK_URL?.trim() || DEFAULT_NPS_WEBHOOK_URL;
  const parsed = new URL(configured);

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    throw new Error("El webhook de NPS debe ser una URL HTTPS válida.");
  }

  return parsed.toString();
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
