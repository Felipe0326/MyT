import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../../lib/session";
import { readJsonOrText, userRest } from "../../../../lib/supabase";

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

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    const response = NextResponse.json({ error: auth.message }, { status: auth.status });
    if (auth.clearCookies) clearSessionCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  const permission = auth.context.sections.find(
    (section) => section.slug === "dashboard-nps" && section.can_export,
  );
  if (!permission) {
    return NextResponse.json(
      { error: "No tienes permiso para exportar este tablero." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const params = request.nextUrl.searchParams;
  const sort = VALID_SORTS.has(params.get("sort") ?? "") ? params.get("sort")! : "date";
  const direction = VALID_DIRECTIONS.has(params.get("direction") ?? "")
    ? params.get("direction")!
    : "desc";

  const rpcResponse = await userRest(
    "rpc/get_nps_filtered_rows_tym_v2",
    auth.context.accessToken,
    {
      method: "POST",
      body: {
        p_dependencia: nullable(params.get("dependencia")),
        p_sucursal: nullable(params.get("sucursal")),
        p_recomienda: nullableBoolean(params.get("recomienda")),
        p_date_from: nullable(params.get("dateFrom")),
        p_date_to: nullable(params.get("dateTo")),
        p_sort: sort,
        p_direction: direction,
      },
    },
  );

  if (!rpcResponse.ok) {
    const detail = await readJsonOrText(rpcResponse);
    return NextResponse.json(
      {
        error: "No fue posible exportar los registros NPS.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      { status: rpcResponse.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(await rpcResponse.json(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
