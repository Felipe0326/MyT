import { NextRequest, NextResponse } from "next/server";
import {
  clientRateLimitRule,
  consumeRateLimits,
  RateLimitUnavailableError,
  rateLimitResponse,
  rateLimitUnavailableResponse,
  resetRateLimits,
  type RateLimitRule,
} from "../../../../lib/rate-limit";
import {
  readLimitedJson,
  RequestSecurityError,
  verifyMutationOrigin,
} from "../../../../lib/request-security";
import { loginSchema } from "../../../../lib/security";
import { signInWithPassword } from "../../../../lib/supabase";
import { applySessionCookies, createAppSession } from "../../../../lib/session";

export async function POST(request: NextRequest) {
  if (!verifyMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origen de solicitud no autorizado." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const clientRule = clientRateLimitRule(request, "auth:login:ip", 100, 10 * 60, 15 * 60);
  let raw: unknown;
  try {
    const clientLimit = await consumeRateLimits([clientRule]);
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

  const input = loginSchema.safeParse(raw);
  if (!input.success) {
    return NextResponse.json(
      { error: "Correo o contraseña inválidos." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const accountRule: RateLimitRule = {
    scope: "auth:login:account",
    identifier: input.data.email,
    limit: 8,
    windowSeconds: 15 * 60,
    blockSeconds: 30 * 60,
  };

  try {
    const accountLimit = await consumeRateLimits([accountRule]);
    if (!accountLimit.allowed) return rateLimitResponse(accountLimit);
    const tokens = await signInWithPassword(input.data.email, input.data.password);
    await createAppSession(tokens, request);
    await Promise.allSettled([resetRateLimits([accountRule])]);

    const response = NextResponse.json({ ok: true });
    applySessionCookies(response, tokens);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    const message = error instanceof Error ? error.message : "No fue posible iniciar sesión.";
    return NextResponse.json(
      { error: message },
      {
        status: /configuración|Falta la variable|registrar la sesión/i.test(message) ? 503 : 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
