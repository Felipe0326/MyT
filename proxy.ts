import { NextRequest, NextResponse } from "next/server";

const BLOCKED_METHODS = new Set(["TRACE", "TRACK", "CONNECT"]);
const MAX_API_BODY_BYTES = 1024 * 1024;

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

  const requestHeaders = new Headers(request.headers);
  const requestId = crypto.randomUUID();
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("X-Request-Id", requestId);
  return response;
}

export const config = {
  matcher: "/api/:path*",
};
