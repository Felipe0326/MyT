import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "../../../lib/session";
import { readJsonOrText, userRest } from "../../../lib/supabase";

const SELECT = [
  "id",
  "fecha",
  "anio",
  "mes",
  "dia_semana",
  "tipo_tramite_id",
  "tipo_tramite",
  "tipo_licencia_id",
  "tipo_licencia",
  "tramites_presenciales",
  "tramites_en_linea",
  "total_tramites",
  "actualizado_en",
].join(",");

type LicenciaRow = {
  id: number | string;
  fecha: string;
  anio: number | string;
  mes: string;
  dia_semana: string;
  tipo_tramite_id: number | string;
  tipo_tramite: string;
  tipo_licencia_id: number | string;
  tipo_licencia: string;
  tramites_presenciales: number | string;
  tramites_en_linea: number | string;
  total_tramites: number | string;
  actualizado_en: string;
};

const SORT_FIELDS = {
  date: "fecha",
  tipo_tramite: "tipo_tramite",
  tipo_licencia: "tipo_licencia",
  presencial: "tramites_presenciales",
  en_linea: "tramites_en_linea",
  total: "total_tramites",
} as const;

type Modalidad = "" | "en_linea" | "presencial";

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

function normalizeRow(row: LicenciaRow, modalidad: Modalidad) {
  const presencial = Number(row.tramites_presenciales) || 0;
  const enLinea = Number(row.tramites_en_linea) || 0;
  return {
    ...row,
    id: Number(row.id) || 0,
    anio: Number(row.anio) || 0,
    tipo_tramite_id: Number(row.tipo_tramite_id) || 0,
    tipo_licencia_id: Number(row.tipo_licencia_id) || 0,
    tramites_presenciales: presencial,
    tramites_en_linea: enLinea,
    total_tramites: modalidad === "en_linea"
      ? enLinea
      : modalidad === "presencial"
        ? presencial
        : presencial + enLinea,
  };
}

function resultCount(response: Response, fallback: number) {
  const contentRange = response.headers.get("content-range");
  const parsed = Number(contentRange?.split("/").at(-1));
  return Number.isFinite(parsed) ? parsed : fallback;
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
  const year = integer(params.get("year"), 2026, 2000, 2100);
  const month = integer(params.get("month"), 8, 1, 12);
  const defaultFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const defaultTo = `${year}-${String(month).padStart(2, "0")}-${monthEnd(year, month)}`;
  const dateFrom = isoDate(params.get("dateFrom")) ?? defaultFrom;
  const dateTo = isoDate(params.get("dateTo")) ?? defaultTo;
  const modalidad = params.get("modalidad") === "en_linea"
    ? "en_linea"
    : params.get("modalidad") === "presencial"
      ? "presencial"
      : "";
  const page = integer(params.get("page"), 1, 1, 1_000_000);
  const pageSize = 50;
  const tipoTramiteId = optionalInteger(params.get("tipoTramiteId"));
  const tipoLicenciaId = optionalInteger(params.get("tipoLicenciaId"));
  const sortKey = params.get("sort") as keyof typeof SORT_FIELDS | null;
  const sortField = sortKey && SORT_FIELDS[sortKey] ? SORT_FIELDS[sortKey] : SORT_FIELDS.date;
  const direction = params.get("direction") === "asc" ? "asc" : "desc";

  if (dateFrom > dateTo) {
    return NextResponse.json(
      { error: "La fecha inicial no puede ser posterior a la fecha final." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const modalidadFilter = modalidad === "en_linea"
    ? "&tramites_en_linea=gt.0"
    : modalidad === "presencial"
      ? "&tramites_presenciales=gt.0"
      : "";
  const typeFilters = `${tipoTramiteId === null ? "" : `&tipo_tramite_id=eq.${tipoTramiteId}`}${tipoLicenciaId === null ? "" : `&tipo_licencia_id=eq.${tipoLicenciaId}`}`;
  const dateFilters = `fecha=gte.${dateFrom}&fecha=lte.${dateTo}`;
  const baseFilters = `${dateFilters}${typeFilters}${modalidadFilter}`;
  const offset = (page - 1) * pageSize;

  const [summaryResponse, recordsResponse, optionsResponse] = await Promise.all([
    userRest(
      `licencias_tramites_tym?select=${SELECT}&${baseFilters}&order=fecha.asc&limit=400`,
      auth.context.accessToken,
    ),
    userRest(
      `licencias_tramites_tym?select=${SELECT}&${baseFilters}&order=${sortField}.${direction}&offset=${offset}&limit=${pageSize}`,
      auth.context.accessToken,
      { headers: { Prefer: "count=exact" } },
    ),
    userRest(
      `licencias_tramites_tym?select=tipo_tramite_id,tipo_tramite,tipo_licencia_id,tipo_licencia&${dateFilters}&order=tipo_tramite.asc,tipo_licencia.asc&limit=5000`,
      auth.context.accessToken,
    ),
  ]);

  if (!summaryResponse.ok || !recordsResponse.ok || !optionsResponse.ok) {
    const failedResponse = !summaryResponse.ok ? summaryResponse : !recordsResponse.ok ? recordsResponse : optionsResponse;
    const detail = await readJsonOrText(failedResponse);
    return NextResponse.json(
      {
        error: "No fue posible consultar los datos de Licencias.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      {
        status: [summaryResponse, recordsResponse, optionsResponse].some((response) => response.status === 404) ? 503 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const [summaryRows, pageRows, optionRows] = await Promise.all([
    summaryResponse.json() as Promise<LicenciaRow[]>,
    recordsResponse.json() as Promise<LicenciaRow[]>,
    optionsResponse.json() as Promise<Array<Pick<LicenciaRow, "tipo_tramite_id" | "tipo_tramite" | "tipo_licencia_id" | "tipo_licencia">>>,
  ]);
  const dailyTrend = summaryRows.map((row) => normalizeRow(row, modalidad));
  const records = pageRows.map((row) => normalizeRow(row, modalidad));

  const totals = dailyTrend.reduce(
    (totals, row) => ({
      tramites_presenciales: totals.tramites_presenciales + row.tramites_presenciales,
      tramites_en_linea: totals.tramites_en_linea + row.tramites_en_linea,
      total_tramites: totals.total_tramites + row.total_tramites,
    }),
    { tramites_presenciales: 0, tramites_en_linea: 0, total_tramites: 0 },
  );
  const metrics = {
    tramites_presenciales: modalidad === "en_linea" ? 0 : totals.tramites_presenciales,
    tramites_en_linea: modalidad === "presencial" ? 0 : totals.tramites_en_linea,
    total_tramites: totals.total_tramites,
  };
  const total = resultCount(recordsResponse, records.length);
  const totalPages = Math.ceil(total / pageSize);
  const tiposTramite = Array.from(
    new Map(optionRows.map((row) => [Number(row.tipo_tramite_id) || 0, row.tipo_tramite])).entries(),
  ).map(([id, nombre]) => ({ id, nombre }));
  const tiposLicencia = Array.from(
    new Map(optionRows.map((row) => [Number(row.tipo_licencia_id) || 0, row.tipo_licencia])).entries(),
  ).map(([id, nombre]) => ({ id, nombre }));

  return NextResponse.json(
    {
      metrics,
      dailyTrend,
      records,
      filters: { tiposTramite, tiposLicencia },
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      },
      actualizado_en: dailyTrend.at(-1)?.actualizado_en ?? null,
    },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  );
}
