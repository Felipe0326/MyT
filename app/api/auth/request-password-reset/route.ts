import { after, NextRequest, NextResponse } from "next/server";
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from "../../../../lib/email";
import {
  clientRateLimitRule,
  consumeRateLimits,
  RateLimitUnavailableError,
  rateLimitResponse,
  rateLimitUnavailableResponse,
} from "../../../../lib/rate-limit";
import {
  readLimitedJson,
  RequestSecurityError,
  verifyMutationOrigin,
} from "../../../../lib/request-security";
import { hashToken, randomToken, requestPasswordResetSchema } from "../../../../lib/security";
import { serviceRest } from "../../../../lib/supabase";

type Profile = {
  id: string;
  email: string;
  full_name: string;
};

const SUCCESS_MESSAGE =
  "Recibirás instrucciones para restablecer la contraseña a través de tu correo.";
const ACCOUNT_NOT_FOUND_MESSAGE =
  "No encontramos una cuenta activa con ese correo. Verifica la dirección e inténtalo nuevamente.";

export async function POST(request: NextRequest) {
  if (!verifyMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origen de solicitud no autorizado." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let raw: unknown;
  try {
    const clientLimit = await consumeRateLimits([
      clientRateLimitRule(request, "auth:password-request:ip", 10, 15 * 60, 30 * 60),
    ]);
    if (!clientLimit.allowed) return rateLimitResponse(clientLimit);
    raw = await readLimitedJson(request, 4 * 1024);
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  const input = requestPasswordResetSchema.safeParse(raw);
  if (!input.success) {
    return NextResponse.json(
      { error: "Escribe un correo electrónico válido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const accountLimit = await consumeRateLimits([
      {
        scope: "auth:password-request:account",
        identifier: input.data.email,
        limit: 3,
        windowSeconds: 60 * 60,
        blockSeconds: 60 * 60,
      },
    ]);
    if (!accountLimit.allowed) return rateLimitResponse(accountLimit);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  try {
    if (!isEmailDeliveryConfigured()) {
      return errorResponse(
        "El servicio de correo no está disponible temporalmente. Inténtalo más tarde.",
        503,
      );
    }

    const profileResponse = await serviceRest(
      `profiles_tym?email=eq.${encodeURIComponent(input.data.email)}&status=eq.activo&select=id,email,full_name&limit=1`,
    );
    if (!profileResponse.ok) {
      return errorResponse(
        "No fue posible verificar el correo en este momento. Inténtalo nuevamente.",
        503,
      );
    }

    const profile = ((await profileResponse.json()) as Profile[])[0];
    if (!profile) return errorResponse(ACCOUNT_NOT_FOUND_MESSAGE, 404);

    const recentThreshold = encodeURIComponent(new Date(Date.now() - 60_000).toISOString());
    const recentResponse = await serviceRest(
      `password_reset_tokens_tym?user_id=eq.${profile.id}&status=eq.pendiente&created_at=gte.${recentThreshold}&select=id&limit=1`,
    );
    if (recentResponse.ok && ((await recentResponse.json()) as Array<{ id: string }>).length) {
      return successResponse();
    }

    const token = randomToken(32);
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const insertResponse = await serviceRest("password_reset_tokens_tym", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: {
        user_id: profile.id,
        email: profile.email,
        token_hash: tokenHash,
        status: "pendiente",
        expires_at: expiresAt,
      },
    });
    if (!insertResponse.ok) {
      return errorResponse(
        "No fue posible preparar la recuperación. Inténtalo nuevamente.",
        500,
      );
    }
    const reset = ((await insertResponse.json()) as Array<{ id: string }>)[0];

    const origin = request.nextUrl.origin;

    // La respuesta de éxito se entrega de inmediato. El envío SMTP continúa
    // después para no mantener cargando la pantalla de recuperación.
    after(async () => {
      try {
        const delivery = await sendPasswordResetEmail({
          email: profile.email,
          fullName: profile.full_name,
          token,
          origin,
        });

        if (!delivery.sent) {
          await revokeReset(reset.id);
          return;
        }

        await Promise.all([
          serviceRest(`password_reset_tokens_tym?id=eq.${reset.id}`, {
            method: "PATCH",
            body: { sent_at: new Date().toISOString() },
          }),
          serviceRest(
            `password_reset_tokens_tym?user_id=eq.${profile.id}&status=eq.pendiente&id=neq.${reset.id}`,
            { method: "PATCH", body: { status: "revocado" } },
          ),
        ]);
      } catch (error) {
        await revokeReset(reset.id);
        console.error("No fue posible entregar el restablecimiento de contraseña.", {
          userId: profile.id,
          message: error instanceof Error ? error.message : "Error desconocido",
        });
      }
    });
  } catch (error) {
    console.error("No fue posible preparar el restablecimiento de contraseña.", {
      message: error instanceof Error ? error.message : "Error desconocido",
    });

    return errorResponse(
      "No fue posible preparar la recuperación. Inténtalo nuevamente.",
      500,
    );
  }

  return successResponse();
}

function successResponse() {
  return NextResponse.json(
    { ok: true, message: SUCCESS_MESSAGE },
    { headers: { "Cache-Control": "no-store" } },
  );
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

async function revokeReset(id: string) {
  await serviceRest(`password_reset_tokens_tym?id=eq.${id}&status=eq.pendiente`, {
    method: "PATCH",
    body: { status: "revocado" },
  });
}
