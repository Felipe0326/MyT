import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  consumeRateLimits,
  RateLimitUnavailableError,
  rateLimitResponse,
  rateLimitUnavailableResponse,
} from "./rate-limit";
import { verifyMutationOrigin } from "./request-security";
import { verifyCsrf } from "./security";
import { authenticateRequest, clearSessionCookies } from "./session";
import {
  N8nWebhookConfigurationError,
  N8nWebhookRequestError,
  triggerN8nWebhook,
  type N8nDashboard,
} from "./n8n-webhook";

type RefreshConfiguration = {
  dashboard: N8nDashboard;
  sectionSlug: string;
  successMessage: string;
};

export async function handleDashboardRefresh(
  request: NextRequest,
  configuration: RefreshConfiguration,
): Promise<NextResponse> {
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
    (section) => section.slug === configuration.sectionSlug && section.can_edit,
  );
  if (!permission) {
    return jsonError("No tienes permiso para ejecutar esta actualización.", 403);
  }

  try {
    const rateLimit = await consumeRateLimits([
      {
        scope: `${configuration.dashboard}:manual-refresh:actor`,
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

  try {
    const result = await triggerN8nWebhook(configuration.dashboard, auth.context.user.id);
    return NextResponse.json(
      {
        ok: true,
        message: result.message || configuration.successMessage,
        recordsProcessed: result.recordsProcessed,
        updatedAt: result.updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof N8nWebhookConfigurationError) {
      console.error(`[${configuration.dashboard}-refresh] Configuración incompleta.`);
      return jsonError("La actualización todavía no está configurada en el servidor.", 503);
    }
    if (error instanceof N8nWebhookRequestError) {
      console.error(
        `[${configuration.dashboard}-refresh] Falló la llamada a n8n: ${error.kind}` +
          (error.upstreamStatus ? ` (${error.upstreamStatus})` : ""),
      );
      if (error.kind === "timeout") {
        return jsonError("La actualización tardó demasiado. Inténtalo nuevamente.", 504);
      }
      return jsonError("No fue posible completar la actualización automática.", 502);
    }

    console.error(`[${configuration.dashboard}-refresh] Error no controlado.`, error);
    return jsonError("No fue posible completar la actualización automática.", 502);
  }
}

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
