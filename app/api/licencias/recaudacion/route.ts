import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../../lib/session";
import { readJsonOrText, userRest } from "../../../../lib/supabase";

const SELECT = [
  "anio",
  "mes",
  "cri",
  "concepto",
  "monto_proyectado",
  "monto_recaudado",
  "fecha_corte",
  "observacion",
  "fuente",
].join(",");

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    const response = NextResponse.json({ error: auth.message }, { status: auth.status });
    if (auth.clearCookies) clearSessionCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const permission = auth.context.sections.find(
    (section) => section.slug === "dashboard-licencias" && section.can_view,
  );
  if (!permission) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar la recaudación de Licencias." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const dataResponse = await userRest(
    `recaudacion_licencias_tym?select=${SELECT}&order=anio.asc,mes.asc&limit=1000`,
    auth.context.accessToken,
  );

  if (!dataResponse.ok) {
    const detail = await readJsonOrText(dataResponse);
    return NextResponse.json(
      {
        error: "No fue posible consultar la recaudación de Licencias.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      {
        status: dataResponse.status === 404 ? 503 : dataResponse.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { refrendo: [], licencias: await dataResponse.json() },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  );
}
