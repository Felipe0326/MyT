import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../../lib/session";
import { readJsonOrText, userRest } from "../../../../lib/supabase";

const REFRENDO_SELECT = [
  "anio",
  "mes",
  "cri",
  "concepto",
  "monto_proyectado",
  "monto_fecha_pago",
  "monto_recaudado",
  "fecha_corte",
  "observacion",
  "fuente",
].join(",");

const LICENCIAS_SELECT = [
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
    (section) => section.slug === "dashboard-2" && section.can_view,
  );

  if (!permission) {
    return NextResponse.json(
      { error: "No tienes permiso para consultar la recaudación de Refrendos." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const [refrendoResponse, licenciasResponse] = await Promise.all([
    userRest(
      `recaudacion_refrendo_tym?select=${REFRENDO_SELECT}&order=anio.asc,mes.asc&limit=1000`,
      auth.context.accessToken,
    ),
    userRest(
      `recaudacion_licencias_tym?select=${LICENCIAS_SELECT}&order=anio.asc,mes.asc&limit=1000`,
      auth.context.accessToken,
    ),
  ]);

  if (!refrendoResponse.ok || !licenciasResponse.ok) {
    const [refrendoDetail, licenciasDetail] = await Promise.all([
      refrendoResponse.ok ? Promise.resolve(null) : readJsonOrText(refrendoResponse),
      licenciasResponse.ok ? Promise.resolve(null) : readJsonOrText(licenciasResponse),
    ]);

    return NextResponse.json(
      {
        error: "No fue posible consultar la recaudación mensual.",
        detail:
          process.env.NODE_ENV === "development"
            ? { refrendo: refrendoDetail, licencias: licenciasDetail }
            : undefined,
      },
      {
        status: refrendoResponse.status === 404 || licenciasResponse.status === 404 ? 503 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const [refrendo, licencias] = await Promise.all([
    refrendoResponse.json(),
    licenciasResponse.json(),
  ]);

  return NextResponse.json(
    { refrendo, licencias },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
      },
    },
  );
}
