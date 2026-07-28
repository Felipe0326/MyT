import type { NextRequest } from "next/server";

const DEFAULT_JSON_LIMIT_BYTES = 16 * 1024;

export class RequestSecurityError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestSecurityError";
  }
}

export function verifyMutationOrigin(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return true;

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  const allowedOrigins = new Set<string>([request.nextUrl.origin]);
  const configuredAppUrl = process.env.APP_URL?.trim();
  if (configuredAppUrl) {
    try {
      allowedOrigins.add(new URL(configuredAppUrl).origin);
    } catch {
      return false;
    }
  }

  try {
    return allowedOrigins.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export async function readLimitedJson(
  request: NextRequest,
  maximumBytes = DEFAULT_JSON_LIMIT_BYTES,
): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestSecurityError(415, "La solicitud debe utilizar contenido JSON.");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    if (!/^\d+$/.test(declaredLength)) {
      throw new RequestSecurityError(400, "El tamaño declarado de la solicitud no es válido.");
    }
    if (Number(declaredLength) > maximumBytes) {
      throw new RequestSecurityError(413, "La solicitud excede el tamaño permitido.");
    }
  }

  if (!request.body) {
    throw new RequestSecurityError(400, "La solicitud no contiene datos.");
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new RequestSecurityError(413, "La solicitud excede el tamaño permitido.");
    }
    chunks.push(value);
  }

  if (!totalBytes) {
    throw new RequestSecurityError(400, "La solicitud no contiene datos.");
  }

  const payload = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(payload);
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestSecurityError(400, "El contenido JSON no es válido.");
  }
}

export function getClientAddress(request: NextRequest): string {
  const address = getClientIpAddress(request);
  if (address) return address;

  const userAgent = request.headers.get("user-agent")?.slice(0, 200) ?? "sin-agente";
  return `desconocida:${userAgent}`;
}

export function getClientIpAddress(request: NextRequest): string | null {
  const candidates = [
    request.headers.get("cf-connecting-ip"),
    request.headers.get("true-client-ip"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for")?.split(",", 1)[0],
  ];
  const address = candidates.find((candidate) => candidate?.trim())?.trim();
  if (!address || address.length > 128) return null;

  const ipv4Parts = address.split(".");
  if (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255)
  ) {
    return address;
  }

  if (address.includes(":") && /^[0-9a-f:.]+$/i.test(address)) {
    try {
      new URL(`http://[${address}]/`);
      return address.toLowerCase();
    } catch {
      return null;
    }
  }

  return null;
}
