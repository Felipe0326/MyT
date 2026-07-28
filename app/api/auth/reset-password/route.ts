import { NextRequest, NextResponse } from "next/server";
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
import { hashToken, resetPasswordSchema } from "../../../../lib/security";
import { adminUpdateUserPassword, serviceRest } from "../../../../lib/supabase";

type PasswordReset = {
  id: string;
  user_id: string;
  status: "pendiente" | "usado" | "expirado" | "revocado";
  expires_at: string;
};

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
      clientRateLimitRule(request, "auth:password-reset:ip", 15, 15 * 60, 30 * 60),
    ]);
    if (!clientLimit.allowed) return rateLimitResponse(clientLimit);
    raw = await readLimitedJson(request, 8 * 1024);
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

  const input = resetPasswordSchema.safeParse(raw);
  if (!input.success) {
    return NextResponse.json(
      { error: input.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const tokenHash = await hashToken(input.data.token);
  try {
    const tokenLimit = await consumeRateLimits([
      {
        scope: "auth:password-reset:token",
        identifier: tokenHash,
        limit: 6,
        windowSeconds: 15 * 60,
        blockSeconds: 60 * 60,
      },
    ]);
    if (!tokenLimit.allowed) return rateLimitResponse(tokenLimit);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  const resetResponse = await serviceRest(
    `password_reset_tokens_tym?token_hash=eq.${tokenHash}&select=id,user_id,status,expires_at&limit=1`,
  );
  if (!resetResponse.ok) {
    return NextResponse.json(
      { error: "El restablecimiento de contraseña aún no está disponible." },
      { status: 503 },
    );
  }

  const reset = ((await resetResponse.json()) as PasswordReset[])[0];
  if (!reset || reset.status !== "pendiente") {
    return NextResponse.json(
      { error: "El enlace no existe o ya fue utilizado." },
      { status: 410 },
    );
  }
  if (Date.now() > new Date(reset.expires_at).getTime()) {
    await serviceRest(`password_reset_tokens_tym?id=eq.${reset.id}&status=eq.pendiente`, {
      method: "PATCH",
      body: { status: "expirado" },
    });
    return NextResponse.json(
      { error: "El enlace venció. Solicita uno nuevo." },
      { status: 410 },
    );
  }

  const usedAt = new Date().toISOString();
  const claimResponse = await serviceRest(
    `password_reset_tokens_tym?id=eq.${reset.id}&status=eq.pendiente`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: { status: "usado", used_at: usedAt },
    },
  );
  const claimed = claimResponse.ok
    ? ((await claimResponse.json()) as Array<{ id: string }>)[0]
    : null;
  if (!claimed) {
    return NextResponse.json(
      { error: "El enlace ya fue utilizado." },
      { status: 410 },
    );
  }

  try {
    await adminUpdateUserPassword(reset.user_id, input.data.password);
    await Promise.all([
      serviceRest(
        `password_reset_tokens_tym?user_id=eq.${reset.user_id}&status=eq.pendiente`,
        { method: "PATCH", body: { status: "revocado" } },
      ),
      serviceRest(
        `app_sessions_tym?user_id=eq.${reset.user_id}&revoked_at=is.null`,
        { method: "PATCH", body: { revoked_at: usedAt } },
      ),
      serviceRest("audit_logs_tym", {
        method: "POST",
        body: {
          actor_user_id: reset.user_id,
          action: "password.reset",
          target_type: "user",
          target_id: reset.user_id,
          metadata: { reset_id: reset.id },
        },
      }),
    ]);
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    await serviceRest(
      `password_reset_tokens_tym?id=eq.${reset.id}&status=eq.usado&used_at=eq.${encodeURIComponent(usedAt)}`,
      { method: "PATCH", body: { status: "pendiente", used_at: null } },
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No fue posible cambiar la contraseña." },
      { status: 500 },
    );
  }
}
