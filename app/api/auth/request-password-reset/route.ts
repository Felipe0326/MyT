import { after, NextRequest, NextResponse } from "next/server";
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from "@/lib/email";
import {
  clientRateLimitRule,
  consumeRateLimits,
  RateLimitUnavailableError,
  rateLimitResponse,
  rateLimitUnavailableResponse,
} from "@/lib/rate-limit";
import {
  readLimitedJson,
  RequestSecurityError,
  verifyMutationOrigin,
} from "@/lib/request-security";
import { hashToken, randomToken, requestPasswordResetSchema } from "@/lib/security";
import { serviceRest } from "@/lib/supabase";

type Profile = {
  id: string;
  email: string;
  full_name: string;
};

const SUCCESS_MESSAGE =
  "Si existe una cuenta activa con ese correo, recibirás instrucciones para restablecer la contraseña.";

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

  if (!isEmailDeliveryConfigured()) {
    return NextResponse.json(
      { error: "El servicio de correo no está disponible temporalmente. Inténtalo más tarde." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const email = input.data.email;
  const origin = request.nextUrl.origin;

  // La respuesta no depende de si el correo existe. La búsqueda, creación del
  // token y entrega se realizan después para evitar enumeración por contenido
  // o por diferencias evidentes de tiempo de respuesta.
  after(async () => {
    await preparePasswordReset(email, origin);
  });

  return successResponse();
}

async function preparePasswordReset(email: string, origin: string) {
  try {
    const profileResponse = await serviceRest(
      `profiles_tym?email=eq.${encodeURIComponent(email)}&status=eq.activo&select=id,email,full_name&limit=1`,
    );
    if (!profileResponse.ok) {
      console.error("No fue posible verificar una solicitud de recuperación de contraseña.");
      return;
    }

    const profile = ((await profileResponse.json()) as Profile[])[0];
    if (!profile) return;

    const recentThreshold = encodeURIComponent(new Date(Date.now() - 60_000).toISOString());
    const recentResponse = await serviceRest(
      `password_reset_tokens_tym?user_id=eq.${profile.id}&status=eq.pendiente&created_at=gte.${recentThreshold}&select=id&limit=1`,
    );
    if (recentResponse.ok && ((await recentResponse.json()) as Array<{ id: string }>).length) {
      return;
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
      console.error("No fue posible crear un token de recuperación de contraseña.");
      return;
    }

    const reset = ((await insertResponse.json()) as Array<{ id: string }>)[0];
    if (!reset) return;

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
    console.error("No fue posible procesar una solicitud de recuperación de contraseña.", {
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

function successResponse() {
  return NextResponse.json(
    { ok: true, message: SUCCESS_MESSAGE },
    { headers: { "Cache-Control": "no-store" } },
  );
}

async function revokeReset(id: string) {
  await serviceRest(`password_reset_tokens_tym?id=eq.${id}&status=eq.pendiente`, {
    method: "PATCH",
    body: { status: "revocado" },
  });
}
