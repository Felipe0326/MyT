import { NextRequest, NextResponse } from "next/server";
import { applySessionCookies, authenticateRequest, clearSessionCookies } from "../../../../lib/session";

export async function GET(request: NextRequest) {
  try {
    const result = await authenticateRequest(request);
    if (!result.ok) {
      // Consultar la sesión al abrir la aplicación es una comprobación normal.
      // Cuando todavía no existe sesión, respondemos 200 sin exponer datos
      // para evitar un error 401 innecesario en la consola del navegador.
      const isUnauthenticated = result.status === 401;
      const response = NextResponse.json(
        isUnauthenticated
          ? { authenticated: false }
          : { authenticated: false, error: result.message },
        { status: isUnauthenticated ? 200 : result.status },
      );
      if (result.clearCookies) clearSessionCookies(response);
      response.headers.set("Cache-Control", "no-store");
      return response;
    }

    const response = NextResponse.json({
      authenticated: true,
      user: result.context.user,
      sections: result.context.sections,
      csrfToken: result.context.csrfToken,
      idleTimeoutMinutes: 30,
    });
    if (result.context.refreshedTokens) {
      applySessionCookies(response, result.context.refreshedTokens, result.context.csrfToken);
    }
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json({ error: "No fue posible comprobar la sesión." }, { status: 503 });
  }
}

