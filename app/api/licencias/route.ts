import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../lib/session";
import { readJsonOrText, userRest } from "../../../lib/supabase";

const MIN_DATE = "2026-01-01";
const VALID_SORTS = new Set([
  "date",
  "tipo_tramite",
  "tipo_licencia",
  "presencial",
  "en_linea",
  "total",
]);

function integer(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function isoDate(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : value;
}

function optionalInteger(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function monthEnd(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

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
      { error: "No tienes permiso para ver el tablero de Licencias." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const params = request.nextUrl.searchParams;
  const year = integer(params.get("year"), 2026, 2026, 2100);
  const month = integer(params.get("month"), 8, 1, 12);
  const defaultFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const defaultTo = `${year}-${String(month).padStart(2, "0")}-${monthEnd(year, month)}`;
  const dateFrom = isoDate(params.get("dateFrom")) ?? defaultFrom;
  const dateTo = isoDate(params.get("dateTo")) ?? defaultTo;
  const modalidad = params.get("modalidad") === "en_linea"
    ? "en_linea"
    : params.get("modalidad") === "presencial"
      ? "presencial"
      : null;
  const page = integer(params.get("page"), 1, 1, 1_000_000);
  const sort = VALID_SORTS.has(params.get("sort") ?? "") ? params.get("sort")! : "date";
  const direction = params.get("direction") === "asc" ? "asc" : "desc";

  if (dateFrom < MIN_DATE || dateTo < MIN_DATE) {
    return NextResponse.json(
      { error: "El tablero de Licencias solamente consulta registros de 2026 en adelante." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (dateFrom > dateTo) {
    return NextResponse.json(
      { error: "La fecha inicial no puede ser posterior a la fecha final." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rpcResponse = await userRest(
    "rpc/get_licencias_dashboard_tym_v1",
    auth.context.accessToken,
    {
      method: "POST",
      body: {
        p_date_from: dateFrom,
        p_date_to: dateTo,
        p_tipo_tramite_id: optionalInteger(params.get("tipoTramiteId")),
        p_tipo_licencia_id: optionalInteger(params.get("tipoLicenciaId")),
        p_modalidad: modalidad,
        p_page: page,
        p_page_size: 50,
        p_sort: sort,
        p_direction: direction,
      },
    },
  );

  if (!rpcResponse.ok) {
    const detail = await readJsonOrText(rpcResponse);
    return NextResponse.json(
      {
        error: "No fue posible consultar los datos optimizados de Licencias.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      {
        status: rpcResponse.status === 404 ? 503 : rpcResponse.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(await rpcResponse.json(), {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
    },
  });
}
