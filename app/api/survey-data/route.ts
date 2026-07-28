import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../lib/session";
import { readJsonOrText, userRest } from "../../../lib/supabase";

const VALID_SORTS = new Set(["date", "dependencia", "feedback", "score"]);
const VALID_DIRECTIONS = new Set(["asc", "desc"]);

function nullable(value: string | null): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function nullableBoolean(value: string | null): boolean | null {
  if (value === "yes" || value === "true") return true;
  if (value === "no" || value === "false") return false;
  return null;
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
    (section) => section.slug === "dashboard-nps" && section.can_view,
  );
  if (!permission) {
    return NextResponse.json(
      { error: "No tienes permiso para ver este tablero." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const params = request.nextUrl.searchParams;
  const sort = VALID_SORTS.has(params.get("sort") ?? "") ? params.get("sort")! : "date";
  const direction = VALID_DIRECTIONS.has(params.get("direction") ?? "")
    ? params.get("direction")!
    : "desc";

  const rpcResponse = await userRest(
    "rpc/get_nps_dashboard_tym_v3",
    auth.context.accessToken,
    {
      method: "POST",
      body: {
        p_dependencia: nullable(params.get("dependencia")),
        p_sucursal: nullable(params.get("sucursal")),
        p_recomienda: nullableBoolean(params.get("recomienda")),
        p_date_from: nullable(params.get("dateFrom")),
        p_date_to: nullable(params.get("dateTo")),
        p_page: positiveInteger(params.get("page"), 1, 1_000_000),
        p_page_size: positiveInteger(params.get("pageSize"), 20, 100),
        p_sort: sort,
        p_direction: direction,
      },
    },
  );

  if (!rpcResponse.ok) {
    const detail = await readJsonOrText(rpcResponse);
    return NextResponse.json(
      {
        error: "No fue posible consultar el tablero NPS.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      {
        status: rpcResponse.status === 404 ? 503 : rpcResponse.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const payload = await rpcResponse.json();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=120",
    },
  });
}
