import "server-only";

import { NextResponse } from "next/server";
import type { DashboardServerContext, DashboardServerModule } from "@/features/dashboards/core/types";
import { readJsonOrText, userRest } from "@/lib/supabase";

const MIN_YEAR = 2025;
const MAX_YEAR = 2026;
const EXPORT_PAGE_SIZE = 1_000;
const MAX_EXPORT_PAGES = 100;
const VALID_SORTS = new Set([
  "date",
  "tipo_tramite",
  "tipo_licencia",
  "presencial",
  "en_linea",
  "total",
]);
const SORT_FIELDS = {
  date: "fecha",
  tipo_tramite: "tipo_tramite",
  tipo_licencia: "tipo_licencia",
  presencial: "tramites_presenciales",
  en_linea: "tramites_en_linea",
  total: "total_tramites",
} as const;
const EXPORT_SELECT = [
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
const REVENUE_SELECT = [
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

type Modalidad = "" | "en_linea" | "presencial";

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

function filters(params: URLSearchParams) {
  const year = integer(params.get("year"), 2026, MIN_YEAR, MAX_YEAR);
  const monthParam = params.get("month");
  const month = monthParam === null ? null : integer(monthParam, 8, 1, 12);
  const defaultFrom = month === null
    ? `${year}-01-01`
    : `${year}-${String(month).padStart(2, "0")}-01`;
  const defaultTo = month === null
    ? `${year}-12-31`
    : `${year}-${String(month).padStart(2, "0")}-${monthEnd(year, month)}`;
  const dateFrom = isoDate(params.get("dateFrom")) ?? defaultFrom;
  const dateTo = isoDate(params.get("dateTo")) ?? defaultTo;
  const modalidad: Modalidad = params.get("modalidad") === "en_linea"
    ? "en_linea"
    : params.get("modalidad") === "presencial"
      ? "presencial"
      : "";

  return {
    year,
    dateFrom,
    dateTo,
    modalidad,
    tipoTramiteId: optionalInteger(params.get("tipoTramiteId")),
    tipoLicenciaId: optionalInteger(params.get("tipoLicenciaId")),
  };
}

function validateDates(year: number, dateFrom: string, dateTo: string): NextResponse | null {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  if (dateFrom < yearStart || dateFrom > yearEnd || dateTo < yearStart || dateTo > yearEnd) {
    return NextResponse.json(
      { error: `Las fechas deben pertenecer al año ${year}.` },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (dateFrom > dateTo) {
    return NextResponse.json(
      { error: "La fecha inicial no puede ser posterior a la fecha final." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
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

async function getData({ request, session }: DashboardServerContext) {
  const params = request.nextUrl.searchParams;
  const parsed = filters(params);
  const dateError = validateDates(parsed.year, parsed.dateFrom, parsed.dateTo);
  if (dateError) return dateError;

  const sort = VALID_SORTS.has(params.get("sort") ?? "") ? params.get("sort")! : "date";
  const direction = params.get("direction") === "asc" ? "asc" : "desc";
  const rpcResponse = await userRest("rpc/get_licencias_dashboard_tym_v1", session.accessToken, {
    method: "POST",
    body: {
      p_date_from: parsed.dateFrom,
      p_date_to: parsed.dateTo,
      p_tipo_tramite_id: parsed.tipoTramiteId,
      p_tipo_licencia_id: parsed.tipoLicenciaId,
      p_modalidad: parsed.modalidad || null,
      p_page: integer(params.get("page"), 1, 1, 1_000_000),
      p_page_size: 50,
      p_sort: sort,
      p_direction: direction,
    },
  });

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
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}

async function exportData({ request, session }: DashboardServerContext) {
  const params = request.nextUrl.searchParams;
  const parsed = filters(params);
  const dateError = validateDates(parsed.year, parsed.dateFrom, parsed.dateTo);
  if (dateError) return dateError;

  const sortKey = params.get("sort") as keyof typeof SORT_FIELDS | null;
  const sortField = sortKey && SORT_FIELDS[sortKey] ? SORT_FIELDS[sortKey] : SORT_FIELDS.date;
  const direction = params.get("direction") === "asc" ? "asc" : "desc";
  const modalidadFilter = parsed.modalidad === "en_linea"
    ? "&tramites_en_linea=gt.0"
    : parsed.modalidad === "presencial"
      ? "&tramites_presenciales=gt.0"
      : "";
  const typeFilters = `${parsed.tipoTramiteId === null ? "" : `&tipo_tramite_id=eq.${parsed.tipoTramiteId}`}${parsed.tipoLicenciaId === null ? "" : `&tipo_licencia_id=eq.${parsed.tipoLicenciaId}`}`;
  const baseFilters = `fecha=gte.${parsed.dateFrom}&fecha=lte.${parsed.dateTo}${typeFilters}${modalidadFilter}`;
  const records: LicenciaRow[] = [];

  for (let page = 0; page < MAX_EXPORT_PAGES; page += 1) {
    const response = await userRest(
      `licencias_tramites_tym?select=${EXPORT_SELECT}&${baseFilters}&order=${sortField}.${direction},id.asc&offset=${page * EXPORT_PAGE_SIZE}&limit=${EXPORT_PAGE_SIZE}`,
      session.accessToken,
    );

    if (!response.ok) {
      const detail = await readJsonOrText(response);
      return NextResponse.json(
        {
          error: "No fue posible exportar los registros de Licencias.",
          detail: process.env.NODE_ENV === "development" ? detail : undefined,
        },
        {
          status: response.status === 404 ? 503 : response.status,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    const pageRows = (await response.json()) as LicenciaRow[];
    records.push(...pageRows);
    if (pageRows.length < EXPORT_PAGE_SIZE) {
      return NextResponse.json(
        records.map((row) => normalizeRow(row, parsed.modalidad)),
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
  }

  return NextResponse.json(
    { error: "La exportación supera el máximo permitido de 100,000 registros. Aplica más filtros e inténtalo nuevamente." },
    { status: 413, headers: { "Cache-Control": "no-store" } },
  );
}

async function recaudacion({ session }: DashboardServerContext) {
  const response = await userRest(
    `recaudacion_licencias_tym?select=${REVENUE_SELECT}&order=anio.asc,mes.asc&limit=1000`,
    session.accessToken,
  );

  if (!response.ok) {
    const detail = await readJsonOrText(response);
    return NextResponse.json(
      {
        error: "No fue posible consultar la recaudación de Licencias.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      {
        status: response.status === 404 ? 503 : response.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { refrendo: [], licencias: await response.json() },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  );
}

export const licenciasServer: DashboardServerModule = {
  getData,
  exportData,
  datasets: { recaudacion },
};
