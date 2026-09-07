// Datos operativos propios del tablero de Refrendos.

// Types
export interface TramiteData {
  date: string;
  fullDate: Date;
  day: number;
  month: number;
  year: number;
  dayOfWeek: string;
  total: number;
  digital: number;
  traditional: number;
  unclassified?: number;
  total2024?: number;
  total2025?: number;
  hora?: number;
}

export interface GestorData {
  month: string;
  year: number;
  fullLabel: string;
  gestores: number;
  totalGeneral: number;
}

export interface DailyRevenueData {
  date: string;
  publico: number;
  particular: number;
}

export type RefrendoSortKey = 'date' | 'movimiento' | 'total' | 'digital' | 'tradicional' | 'hora';
export type SortDirection = 'asc' | 'desc';

export type RefrendoRecord = {
  id: number;
  fecha: string;
  anio: number;
  mes: number;
  dia: number;
  dia_semana: string | null;
  movimiento: string | null;
  total_registros: number;
  es_digital: number;
  es_tradicional: number;
  porcentaje_digital: number;
  porcentaje_tradicional: number;
  resultado: boolean | null;
  mensaje: string | null;
  error: number | null;
  hora: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type RefrendoDashboardResponse = {
  metrics: {
    total_filas: number;
    total_registros: number;
    es_digital: number;
    es_tradicional: number;
    porcentaje_digital: number;
    porcentaje_tradicional: number;
    fecha_minima: string | null;
    fecha_maxima: string | null;
  };
  dailyTrend: Array<{
    fecha: string;
    totalRegistros: number;
    digital: number;
    tradicional: number;
    filas: number;
  }>;
  hourlyTrend: Array<{
    hora: number | null;
    totalRegistros: number;
    digital: number;
    tradicional: number;
    filas: number;
  }>;
  movimientos: string[];
  records: RefrendoRecord[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
};

export type RefrendoDashboardQuery = {
  year?: number;
  month?: number;
  dateFrom?: string;
  dateTo?: string;
  movimiento?: string;
  hora?: number;
  page?: number;
  pageSize?: number;
  sort?: RefrendoSortKey;
  direction?: SortDirection;
};

export const EMPTY_REFRENDO_DASHBOARD: RefrendoDashboardResponse = {
  metrics: {
    total_filas: 0,
    total_registros: 0,
    es_digital: 0,
    es_tradicional: 0,
    porcentaje_digital: 0,
    porcentaje_tradicional: 0,
    fecha_minima: null,
    fecha_maxima: null,
  },
  dailyTrend: [],
  hourlyTrend: [],
  movimientos: [],
  records: [],
  pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0, hasPrevious: false, hasNext: false },
};


const DASHBOARD_CACHE_TTL_MS = 30_000;

type DashboardCacheEntry = {
  expiresAt: number;
  value: RefrendoDashboardResponse;
};

const dashboardCache = new Map<string, DashboardCacheEntry>();

function dashboardCacheKey(query: RefrendoDashboardQuery): string {
  return JSON.stringify({
    year: query.year ?? null,
    month: query.month ?? null,
    dateFrom: query.dateFrom ?? null,
    dateTo: query.dateTo ?? null,
    movimiento: query.movimiento ?? null,
    hora: query.hora ?? null,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 50,
    sort: query.sort ?? 'date',
    direction: query.direction ?? 'desc',
  });
}

export function clearRefrendoDashboardCache(): void {
  dashboardCache.clear();
}

function niceAxisMaximum(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 100;

  let step = 100;
  if (value > 1_000 && value <= 5_000) step = 500;
  else if (value > 5_000 && value <= 10_000) step = 1_000;
  else if (value > 10_000 && value <= 50_000) step = 5_000;
  else if (value > 50_000) step = 10_000;

  return Math.ceil(value / step) * step;
}

export const fetchRefrendoDashboard = async (
  query: RefrendoDashboardQuery = {},
  signal?: AbortSignal,
): Promise<RefrendoDashboardResponse> => {
  const cacheKey = dashboardCacheKey(query);
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (cached) dashboardCache.delete(cacheKey);

  const params = new URLSearchParams();
  if (query.year != null) params.set('year', String(query.year));
  if (query.month != null) params.set('month', String(query.month));
  if (query.dateFrom) params.set('dateFrom', query.dateFrom);
  if (query.dateTo) params.set('dateTo', query.dateTo);
  if (query.movimiento) params.set('movimiento', query.movimiento);
  if (query.hora != null) params.set('hora', String(query.hora));
  params.set('page', String(query.page ?? 1));
  params.set('pageSize', String(query.pageSize ?? 50));
  params.set('sort', query.sort ?? 'date');
  params.set('direction', query.direction ?? 'desc');

  const response = await fetch(`/api/dashboards/dashboard-refrendos?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });

  const payload = await response.json().catch(() => null) as
    | RefrendoDashboardResponse
    | { error?: string }
    | null;
  if (!response.ok) {
    const message = payload && 'error' in payload ? payload.error : undefined;
    throw new Error(message || `Error al consultar Refrendos (${response.status}).`);
  }

  const dashboard = payload as RefrendoDashboardResponse;
  dashboardCache.set(cacheKey, {
    expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    value: dashboard,
  });
  return dashboard;
};

export async function fetchRefrendoYearAxisMax(
  year: number,
  signal?: AbortSignal,
): Promise<number> {
  const dashboard = await fetchRefrendoDashboard({
    year,
    page: 1,
    pageSize: 1,
    sort: 'date',
    direction: 'desc',
  }, signal);

  const maximum = dashboard.dailyTrend.reduce((currentMax, item) => (
    Math.max(
      currentMax,
      Number(item.totalRegistros) || 0,
      Number(item.digital) || 0,
      Number(item.tradicional) || 0,
    )
  ), 0);

  return niceAxisMaximum(maximum);
}

export const getGestoresData = (): GestorData[] => [
  { month: 'Enero', year: 2026, fullLabel: 'Ene 2026', gestores: 10410, totalGeneral: 91936 },
  { month: 'Febrero', year: 2026, fullLabel: 'Feb 2026', gestores: 3, totalGeneral: 7576 },
];

export async function fetchDailyRevenueData(
  year: number,
  signal?: AbortSignal,
): Promise<DailyRevenueData[]> {
  const params = new URLSearchParams({ year: String(year) });
  const response = await fetch(`/api/dashboards/dashboard-refrendos/datasets/recaudacion-diaria?${params.toString()}`, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
  });
  const payload = await response.json().catch(() => null) as
    | DailyRevenueData[]
    | { error?: string }
    | null;

  if (!response.ok) {
    const message = payload && !Array.isArray(payload) ? payload.error : undefined;
    throw new Error(message || `Error al consultar la recaudación diaria (${response.status}).`);
  }

  return Array.isArray(payload) ? payload : [];
}

export const getAggregatedStats = (data: TramiteData[]) => {
  const stats = data.reduce((acc, curr) => {
    acc.total += curr.total;
    acc.digital += curr.digital;
    return acc;
  }, { total: 0, digital: 0 });

  const totalTraditional = stats.total - stats.digital;
  return {
    totalRegistros: stats.total,
    totalDigital: stats.digital,
    totalTraditional,
    digitalPercentage: stats.total > 0 ? ((stats.digital / stats.total) * 100).toFixed(1) : "0",
    traditionalPercentage: stats.total > 0 ? ((totalTraditional / stats.total) * 100).toFixed(1) : "0"
  };
};
