export type MonthlyComparativeData = {
  monthName: string;
  monthIndex: number;
  [key: string]: string | number | undefined;
};

export type RevenueDataset = {
  months: MonthlyComparativeData[];
  years: number[];
  activeYear: number;
  cutoffDate: string | null;
  cri: string | null;
  concepto: string | null;
};

export type RecaudacionDashboardData = {
  refrendo: RevenueDataset;
  licencias: RevenueDataset;
};

type RecaudacionRow = {
  anio: number | string;
  mes: number | string;
  cri: string | null;
  concepto: string | null;
  monto_proyectado: number | string | null;
  monto_fecha_pago?: number | string | null;
  monto_recaudado: number | string | null;
  fecha_corte: string | null;
  observacion?: string | null;
  fuente?: string | null;
};

type RecaudacionApiResponse = {
  refrendo: RecaudacionRow[];
  licencias: RecaudacionRow[];
};

const MONTH_SHORT_NAMES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function emptyRevenueDataset(): RevenueDataset {
  return {
    months: MONTH_SHORT_NAMES.map((monthName, index) => ({
      monthName,
      monthIndex: index + 1,
    })),
    years: [],
    activeYear: new Date().getFullYear(),
    cutoffDate: null,
    cri: null,
    concepto: null,
  };
}

export const EMPTY_RECAUDACION_DASHBOARD: RecaudacionDashboardData = {
  refrendo: emptyRevenueDataset(),
  licencias: emptyRevenueDataset(),
};

function optionalNumber(value: number | string | null | undefined): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildRevenueDataset(rows: RecaudacionRow[]): RevenueDataset {
  if (!Array.isArray(rows) || rows.length === 0) return emptyRevenueDataset();

  const years = Array.from(new Set(
    rows
      .map((row) => Number(row.anio))
      .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2200),
  )).sort((left, right) => left - right);

  const activeYear = years.at(-1) ?? new Date().getFullYear();
  const actualKey = `year${activeYear}CuentaComprobada`;
  const projectedKey = `year${activeYear}Projected`;
  const paymentKey = `year${activeYear}FechaPago`;

  const months = MONTH_SHORT_NAMES.map((monthName, index) => ({
    monthName,
    monthIndex: index + 1,
  } as MonthlyComparativeData));

  let cutoffDate: string | null = null;
  let cri: string | null = null;
  let concepto: string | null = null;

  for (const row of rows) {
    const year = Number(row.anio);
    const month = Number(row.mes);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) continue;

    const target = months[month - 1];
    const actual = optionalNumber(row.monto_recaudado);
    const projected = optionalNumber(row.monto_proyectado);
    const payment = optionalNumber(row.monto_fecha_pago);

    if (year === activeYear) {
      if (projected !== undefined) target[projectedKey] = projected;
      if (payment !== undefined) target[paymentKey] = payment;
      if (actual !== undefined) target[actualKey] = actual;
    } else if (actual !== undefined) {
      target[`year${year}`] = actual;
    }

    if (actual !== undefined && year === activeYear && row.fecha_corte) {
      if (!cutoffDate || row.fecha_corte > cutoffDate) cutoffDate = row.fecha_corte;
    }

    cri ??= row.cri;
    concepto ??= row.concepto;
  }

  return { months, years, activeYear, cutoffDate, cri, concepto };
}

export async function fetchRecaudacionDashboard(
  signal?: AbortSignal,
  endpoint = "/api/dashboards/dashboard-refrendos/datasets/recaudacion",
): Promise<RecaudacionDashboardData> {
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });

  const payload = await response.json().catch(() => null) as
    | RecaudacionApiResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message = payload && "error" in payload ? payload.error : undefined;
    throw new Error(message || `Error al consultar la recaudación (${response.status}).`);
  }

  const data = payload as RecaudacionApiResponse;
  return {
    refrendo: buildRevenueDataset(data.refrendo ?? []),
    licencias: buildRevenueDataset(data.licencias ?? []),
  };
}
