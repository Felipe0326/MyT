import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../lib/session";
import { readJsonOrText, userRest } from "../../../lib/supabase";

const VALID_SORTS = new Set(["date", "movimiento", "total", "digital", "tradicional", "hora"]);
const VALID_DIRECTIONS = new Set(["asc", "desc"]);

function nullableText(value: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function nullableInteger(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, maximum);
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
    (section) => section.slug === "dashboard-2" && section.can_view,
  );
  if (!permission) {
    return NextResponse.json(
      { error: "No tienes permiso para ver el tablero de Refrendos." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const params = request.nextUrl.searchParams;
  const sort = VALID_SORTS.has(params.get("sort") ?? "") ? params.get("sort")! : "date";
  const direction = VALID_DIRECTIONS.has(params.get("direction") ?? "")
    ? params.get("direction")!
    : "desc";

  const rpcResponse = await userRest(
    "rpc/get_refrendo_dashboard_tym_v2",
    auth.context.accessToken,
    {
      method: "POST",
      body: {
        p_anio: nullableInteger(params.get("year"), 2000, 2100),
        p_mes: nullableInteger(params.get("month"), 1, 12),
        p_date_from: nullableText(params.get("dateFrom")),
        p_date_to: nullableText(params.get("dateTo")),
        p_movimiento: nullableText(params.get("movimiento")),
        p_hora: nullableInteger(params.get("hora"), 0, 23),
        p_page: positiveInteger(params.get("page"), 1, 1_000_000),
        p_page_size: positiveInteger(params.get("pageSize"), 50, 500),
        p_sort: sort,
        p_direction: direction,
      },
    },
  );

  if (!rpcResponse.ok) {
    const detail = await readJsonOrText(rpcResponse);
    return NextResponse.json(
      {
        error: "No fue posible consultar los datos de Refrendos.",
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
