import "server-only";

import { NextResponse } from "next/server";
import type { DashboardServerContext, DashboardServerModule } from "@/features/dashboards/core/types";
import { readJsonOrText, userRest } from "@/lib/supabase";

const VALID_SORTS = new Set(["date", "movimiento", "total", "digital", "tradicional", "hora"]);
const VALID_DIRECTIONS = new Set(["asc", "desc"]);

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

type DailyRevenueRow = {
  fecha: string;
  tipo_servicio: "particular" | "publico";
  monto: number | string;
};

type DailyRevenuePoint = {
  date: string;
  publico: number;
  particular: number;
};

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

function yearParameter(value: string | null): number {
  const year = Number.parseInt(value ?? "", 10);
  return Number.isInteger(year) && year >= 2000 && year <= 2100
    ? year
    : new Date().getFullYear();
}

function dashboardBody(params: URLSearchParams, paged: boolean) {
  return {
    p_anio: nullableInteger(params.get("year"), 2000, 2100),
    p_mes: nullableInteger(params.get("month"), 1, 12),
    p_date_from: nullableText(params.get("dateFrom")),
    p_date_to: nullableText(params.get("dateTo")),
    p_movimiento: nullableText(params.get("movimiento")),
    p_hora: nullableInteger(params.get("hora"), 0, 23),
    ...(paged
      ? {
          p_page: positiveInteger(params.get("page"), 1, 1_000_000),
          p_page_size: positiveInteger(params.get("pageSize"), 50, 500),
        }
      : {}),
    p_sort: VALID_SORTS.has(params.get("sort") ?? "") ? params.get("sort")! : "date",
    p_direction: VALID_DIRECTIONS.has(params.get("direction") ?? "")
      ? params.get("direction")!
      : "desc",
  };
}

async function getData({ request, session }: DashboardServerContext) {
  const rpcResponse = await userRest("rpc/get_refrendo_dashboard_tym_v2", session.accessToken, {
    method: "POST",
    body: dashboardBody(request.nextUrl.searchParams, true),
  });

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
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" },
  });
}

async function exportData({ request, session }: DashboardServerContext) {
  const rpcResponse = await userRest("rpc/get_refrendo_filtered_rows_tym", session.accessToken, {
    method: "POST",
    body: dashboardBody(request.nextUrl.searchParams, false),
  });

  if (!rpcResponse.ok) {
    const detail = await readJsonOrText(rpcResponse);
    return NextResponse.json(
      {
        error: "No fue posible exportar los registros de Refrendos.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      { status: rpcResponse.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(await rpcResponse.json(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function recaudacion({ session }: DashboardServerContext) {
  const response = await userRest(
    `recaudacion_refrendo_tym?select=${REFRENDO_SELECT}&order=anio.asc,mes.asc&limit=1000`,
    session.accessToken,
  );

  if (!response.ok) {
    const detail = await readJsonOrText(response);
    return NextResponse.json(
      {
        error: "No fue posible consultar la recaudación de Refrendos.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      {
        status: response.status === 404 ? 503 : response.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  return NextResponse.json(
    { refrendo: await response.json(), licencias: [] },
    { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=120" } },
  );
}

async function recaudacionDiaria({ request, session }: DashboardServerContext) {
  const year = yearParameter(request.nextUrl.searchParams.get("year"));
  const response = await userRest(
    `recaudacion_refrendo_diaria_tym?select=fecha,tipo_servicio,monto` +
      `&fecha=gte.${year}-01-01&fecha=lte.${year}-12-31&order=fecha.asc&limit=5000`,
    session.accessToken,
  );

  if (!response.ok) {
    const detail = await readJsonOrText(response);
    return NextResponse.json(
      {
        error: "No fue posible consultar la recaudación diaria de Refrendos.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      {
        status: response.status === 404 ? 503 : response.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }

  const rows = (await response.json()) as DailyRevenueRow[];
  const points = new Map<string, DailyRevenuePoint>();

  for (const row of rows) {
    if (row.tipo_servicio !== "publico" && row.tipo_servicio !== "particular") continue;
    const [rowYear, month, day] = row.fecha.split("-");
    if (!rowYear || !month || !day) continue;
    const date = `${day}/${month}/${rowYear}`;
    const point = points.get(date) ?? { date, publico: 0, particular: 0 };
    const amount = Number(row.monto);
    if (Number.isFinite(amount)) point[row.tipo_servicio] += amount;
    points.set(date, point);
  }

  return NextResponse.json(Array.from(points.values()), {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}

export const refrendosServer: DashboardServerModule = {
  getData,
  exportData,
  datasets: {
    recaudacion,
    "recaudacion-diaria": recaudacionDiaria,
  },
};
