import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getClientAddress } from "./request-security";
import { serviceRest } from "./supabase";

export type RateLimitRule = {
  scope: string;
  identifier: string;
  limit: number;
  windowSeconds: number;
  blockSeconds: number;
};

type RateLimitRow = {
  allowed: boolean;
  retry_after_seconds: number;
  remaining: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("No fue posible validar el control de intentos.");
    this.name = "RateLimitUnavailableError";
  }
}

const RPC_MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export function clientRateLimitRule(
  request: NextRequest,
  scope: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
): RateLimitRule {
  return {
    scope,
    identifier: getClientAddress(request),
    limit,
    windowSeconds,
    blockSeconds,
  };
}

export async function consumeRateLimits(rules: RateLimitRule[]): Promise<RateLimitResult> {
  const results = await Promise.all(rules.map(consumeRateLimit));
  const rejected = results.filter((result) => !result.allowed);
  return rejected.length
    ? {
        allowed: false,
        retryAfterSeconds: Math.max(...rejected.map((result) => result.retryAfterSeconds)),
      }
    : { allowed: true, retryAfterSeconds: 0 };
}

export async function resetRateLimits(rules: RateLimitRule[]): Promise<void> {
  await Promise.all(
    rules.map(async (rule) => {
      const keyHash = await hashRateLimitKey(rule.scope, rule.identifier);
      await callRateLimitRpc("rpc/reset_rate_limit_tym", {
        p_key_hash: keyHash,
      });
    }),
  );
}

export function rateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = Math.max(60, Math.min(3600, Math.ceil(result.retryAfterSeconds / 60) * 60));
  return NextResponse.json(
    { error: "Demasiados intentos. Espera unos minutos antes de volver a intentarlo." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

export function rateLimitUnavailableResponse(): NextResponse {
  return NextResponse.json(
    {
      error:
        "No fue posible comunicarse con el servicio de seguridad. Verifica tu conexión e inténtalo nuevamente.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

async function consumeRateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  validateRule(rule);
  const keyHash = await hashRateLimitKey(rule.scope, rule.identifier);
  const response = await callRateLimitRpc("rpc/consume_rate_limit_tym", {
    p_key_hash: keyHash,
    p_scope: rule.scope,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
    p_block_seconds: rule.blockSeconds,
  });

  let rows: RateLimitRow[];
  try {
    rows = (await response.json()) as RateLimitRow[];
  } catch (error) {
    console.error("[rate-limit] Respuesta JSON inválida de consume_rate_limit_tym", error);
    throw new RateLimitUnavailableError();
  }

  const row = rows[0];
  if (!row || typeof row.allowed !== "boolean") {
    console.error("[rate-limit] consume_rate_limit_tym no devolvió el formato esperado.");
    throw new RateLimitUnavailableError();
  }

  return {
    allowed: row.allowed,
    retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds) || 0),
  };
}

async function callRateLimitRpc(path: string, body: Record<string, unknown>): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RPC_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await serviceRest(path, {
        method: "POST",
        body,
      });

      if (response.ok) return response;

      const detail = await response.text().catch(() => "");
      lastError = new Error(
        `${path} respondió ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      );

      if (!RETRYABLE_STATUS_CODES.has(response.status)) break;
    } catch (error) {
      lastError = error;
    }

    if (attempt < RPC_MAX_ATTEMPTS) {
      await wait(300 * attempt);
    }
  }

  console.error(`[rate-limit] Falló ${path} después de ${RPC_MAX_ATTEMPTS} intentos.`, lastError);
  throw new RateLimitUnavailableError();
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function hashRateLimitKey(scope: string, identifier: string): Promise<string> {
  const secret =
    process.env.RATE_LIMIT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new RateLimitUnavailableError();

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`tym-v1:${scope}:${identifier}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validateRule(rule: RateLimitRule): void {
  if (
    !/^[a-z0-9:_-]{1,80}$/i.test(rule.scope) ||
    !rule.identifier ||
    rule.identifier.length > 512 ||
    !Number.isInteger(rule.limit) ||
    rule.limit < 1 ||
    rule.limit > 10_000 ||
    !Number.isInteger(rule.windowSeconds) ||
    rule.windowSeconds < 1 ||
    rule.windowSeconds > 86_400 ||
    !Number.isInteger(rule.blockSeconds) ||
    rule.blockSeconds < 1 ||
    rule.blockSeconds > 86_400
  ) {
    throw new RateLimitUnavailableError();
  }
}
