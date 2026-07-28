import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { getClientIpAddress } from "./request-security";
import { randomToken } from "./security";
import {
  getVerifiedAuthUser,
  refreshAuthToken,
  serviceRest,
  type AuthTokens,
} from "./supabase";

const ACCESS_COOKIE = "tlm_access";
const REFRESH_COOKIE = "tlm_refresh";
const CSRF_COOKIE = "tlm_csrf";
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

export type AppRole = "administrador" | "editor" | "consulta";

export type AppSection = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
  availability: "disponible" | "proximamente";
  can_view: boolean;
  can_edit: boolean;
  can_export: boolean;
};

export type SessionContext = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  refreshedTokens?: AuthTokens;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: AppRole;
    status: "activo" | "inactivo";
  };
  sections: AppSection[];
  sessionId: string;
};

type AuthResult =
  | { ok: true; context: SessionContext }
  | { ok: false; status: number; message: string; clearCookies?: boolean };

export async function authenticateRequest(request: NextRequest, touch = true): Promise<AuthResult> {
  let accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  let refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const csrfToken = request.cookies.get(CSRF_COOKIE)?.value ?? randomToken(24);
  if (!refreshToken) return { ok: false, status: 401, message: "Sesión no encontrada.", clearCookies: true };

  let authUser = accessToken ? await getVerifiedAuthUser(accessToken) : null;
  let refreshedTokens: AuthTokens | undefined;
  if (!authUser) {
    try {
      refreshedTokens = await refreshAuthToken(refreshToken);
      accessToken = refreshedTokens.access_token;
      refreshToken = refreshedTokens.refresh_token;
      authUser = refreshedTokens.user;
    } catch {
      return { ok: false, status: 401, message: "La sesión expiró.", clearCookies: true };
    }
  }

  const sessionId = readJwtSessionId(accessToken!);
  if (!sessionId) return { ok: false, status: 401, message: "Sesión inválida.", clearCookies: true };

  const [profileResponse, sessionResponse] = await Promise.all([
    serviceRest(`profiles_tym?id=eq.${encodeURIComponent(authUser.id)}&select=id,full_name,role,status&limit=1`),
    serviceRest(`app_sessions_tym?session_id=eq.${encodeURIComponent(sessionId)}&select=session_id,last_activity_at,absolute_expires_at,revoked_at&limit=1`),
  ]);

  if (!profileResponse.ok || !sessionResponse.ok) {
    return { ok: false, status: 503, message: "La configuración de seguridad aún no está instalada." };
  }

  const profiles = (await profileResponse.json()) as Array<{
    id: string;
    full_name: string;
    role: AppRole;
    status: "activo" | "inactivo";
  }>;
  const sessions = (await sessionResponse.json()) as Array<{
    session_id: string;
    last_activity_at: string;
    absolute_expires_at: string;
    revoked_at: string | null;
  }>;
  const profile = profiles[0];
  const appSession = sessions[0];
  if (!profile || profile.status !== "activo") {
    return { ok: false, status: 403, message: "La cuenta está inactiva.", clearCookies: true };
  }
  if (!appSession || appSession.revoked_at) {
    return { ok: false, status: 401, message: "La sesión fue cerrada.", clearCookies: true };
  }

  const now = Date.now();
  if (
    now - new Date(appSession.last_activity_at).getTime() > IDLE_TIMEOUT_MS ||
    now > new Date(appSession.absolute_expires_at).getTime()
  ) {
    await serviceRest(`app_sessions_tym?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: { revoked_at: new Date().toISOString() },
    });
    return { ok: false, status: 401, message: "La sesión terminó por inactividad.", clearCookies: true };
  }

  const sections = await loadSections(authUser.id, profile.role);
  if (touch && now - new Date(appSession.last_activity_at).getTime() > 60_000) {
    await serviceRest(`app_sessions_tym?session_id=eq.${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      body: { last_activity_at: new Date().toISOString() },
    });
  }

  return {
    ok: true,
    context: {
      accessToken: accessToken!,
      refreshToken,
      csrfToken,
      refreshedTokens,
      user: {
        id: authUser.id,
        email: authUser.email ?? "",
        fullName: profile.full_name,
        role: profile.role,
        status: profile.status,
      },
      sections,
      sessionId,
    },
  };
}

export async function createAppSession(tokens: AuthTokens, request: NextRequest): Promise<void> {
  const sessionId = readJwtSessionId(tokens.access_token);
  if (!sessionId) throw new Error("Supabase no devolvió un identificador de sesión válido.");
  const now = new Date();
  const response = await serviceRest("app_sessions_tym?on_conflict=session_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: {
      session_id: sessionId,
      user_id: tokens.user.id,
      last_activity_at: now.toISOString(),
      absolute_expires_at: new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS).toISOString(),
      ip_address: getClientIpAddress(request),
      user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      revoked_at: null,
    },
  });
  if (!response.ok) throw new Error("No fue posible registrar la sesión segura.");
}

export function applySessionCookies(response: NextResponse, tokens: AuthTokens, csrfToken = randomToken(24)) {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    priority: "high",
    maxAge: tokens.expires_in,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: "/",
    priority: "high",
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
  });
  response.cookies.set(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: "strict",
    path: "/",
    priority: "high",
    maxAge: ABSOLUTE_TIMEOUT_MS / 1000,
  });
}

export function clearSessionCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === "production";
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: name !== CSRF_COOKIE,
      secure,
      sameSite: "strict",
      path: "/",
      priority: "high",
      maxAge: 0,
    });
  }
}

async function loadSections(userId: string, role: AppRole): Promise<AppSection[]> {
  const sectionsResponse = await serviceRest(
    "app_sections_tym?select=id,slug,title,description,icon,sort_order,availability,is_active&is_active=eq.true&order=sort_order.asc",
  );
  if (!sectionsResponse.ok) return [];
  const rawSections = (await sectionsResponse.json()) as Array<Omit<AppSection, "can_view" | "can_edit" | "can_export">>;
  const sections = rawSections.map((section) => (
    section.slug === "dashboard-2"
      ? { ...section, availability: "disponible" as const }
      : section
  ));
  if (role === "administrador") {
    return sections.map((section) => ({ ...section, can_view: true, can_edit: true, can_export: true }));
  }
  const grantsResponse = await serviceRest(
    `user_section_permissions_tym?user_id=eq.${encodeURIComponent(userId)}&select=section_id,can_view,can_edit,can_export`,
  );
  const grants = grantsResponse.ok
    ? ((await grantsResponse.json()) as Array<{ section_id: string; can_view: boolean; can_edit: boolean; can_export: boolean }>)
    : [];
  const grantMap = new Map(grants.map((grant) => [grant.section_id, grant]));
  return sections
    .filter((section) => grantMap.get(section.id)?.can_view)
    .map((section) => ({ ...section, ...grantMap.get(section.id)! }));
}

function readJwtSessionId(jwt: string): string | null {
  try {
    const payloadPart = jwt.split(".")[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { session_id?: string };
    return payload.session_id ?? null;
  } catch {
    return null;
  }
}
