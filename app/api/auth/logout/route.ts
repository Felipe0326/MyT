import { NextRequest, NextResponse } from "next/server";
import { verifyMutationOrigin } from "../../../../lib/request-security";
import { verifyCsrf } from "../../../../lib/security";
import { authenticateRequest, clearSessionCookies } from "../../../../lib/session";
import { serviceRest, supabaseFetch } from "../../../../lib/supabase";

export async function POST(request: NextRequest) {
  if (!verifyMutationOrigin(request)) {
    return NextResponse.json({ error: "Origen de solicitud no autorizado." }, { status: 403 });
  }
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: "Solicitud no autorizada." }, { status: 403 });
  }

  const result = await authenticateRequest(request, false);
  if (result.ok) {
    await Promise.allSettled([
      serviceRest(`app_sessions_tym?session_id=eq.${encodeURIComponent(result.context.sessionId)}`, {
        method: "PATCH",
        body: { revoked_at: new Date().toISOString() },
      }),
      supabaseFetch("/auth/v1/logout?scope=global", {
        method: "POST",
        accessToken: result.context.accessToken,
      }),
    ]);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
