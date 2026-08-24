import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../../lib/session";
import { collectPaginatedRows } from "../../../../lib/paginated-rows";
import { readJsonOrText, userRest } from "../../../../lib/supabase";

const VALID_SORTS = new Set(["date", "dependencia", "feedback", "score"]);
const VALID_DIRECTIONS = new Set(["asc", "desc"]);
const EXPORT_PAGE_SIZE = 1000;

type NpsExportRow = {
  submit_id: string | number;
  [key: string]: unknown;
};

class NpsExportRequestError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super("No fue posible consultar una página de la exportación NPS.");
  }
}

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

  const body = {
    p_dependencia: nullable(params.get("dependencia")),
    p_sucursal: nullable(params.get("sucursal")),
    p_recomienda: nullableBoolean(params.get("recomienda")),
    p_date_from: nullable(params.get("dateFrom")),
    p_date_to: nullable(params.get("dateTo")),
    p_sort: sort,
    p_direction: direction,
  };

  try {
    const records = await collectPaginatedRows(
      async (from, to) => {
        const limit = to - from + 1;
        const rpcResponse = await userRest(
          `rpc/get_nps_filtered_rows_tym_v2?offset=${from}&limit=${limit}`,
          auth.context.accessToken,
          {
            method: "POST",
            body,
            timeoutMs: 30_000,
          },
        );

        if (!rpcResponse.ok) {
          throw new NpsExportRequestError(
            rpcResponse.status,
            await readJsonOrText(rpcResponse),
          );
        }

        const rows = (await rpcResponse.json()) as unknown;
        if (!Array.isArray(rows)) {
          throw new Error("Supabase devolvió una respuesta inválida para la exportación NPS.");
        }

        return {
          rows: rows as NpsExportRow[],
        };
      },
      {
        pageSize: EXPORT_PAGE_SIZE,
        getRowKey: (row) => row.submit_id,
      },
    );

    return NextResponse.json(records, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof NpsExportRequestError ? error.status : 502;
    const detail = error instanceof NpsExportRequestError ? error.detail : String(error);
    return NextResponse.json(
      {
        error: "No fue posible exportar los registros NPS.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
