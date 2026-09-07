import { NextRequest, NextResponse } from "next/server";

const BLOCKED_METHODS = new Set(["TRACE", "TRACK", "CONNECT"]);
const MAX_API_BODY_BYTES = 1024 * 1024;
const isDevelopment = process.env.NODE_ENV === "development";

function buildContentSecurityPolicy(nonce: string): string {
  const scriptSources = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(isDevelopment ? ["'unsafe-eval'"] : []),
  ].join(" ");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Recharts y algunos componentes visuales necesitan estilos en línea.
    // Se mantiene sólo para estilos; los scripts ya no usan unsafe-inline.
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    `script-src ${scriptSources}`,
    "script-src-attr 'none'",
    "connect-src 'self'",
    ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (BLOCKED_METHODS.has(method)) {
    return new NextResponse("Método no permitido.", {
      status: 405,
      headers: {
        Allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
        "Cache-Control": "no-store",
      },
    });
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const declaredLength = request.headers.get("content-length");
    if (declaredLength && /^\d+$/.test(declaredLength)) {
      const bytes = Number(declaredLength);
      if (Number.isFinite(bytes) && bytes > MAX_API_BODY_BYTES) {
        return new NextResponse("Solicitud demasiado grande.", {
          status: 413,
          headers: { "Cache-Control": "no-store" },
        });
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildContentSecurityPolicy(nonce);

  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf)$).*)",
  ],
};
