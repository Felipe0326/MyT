// La recaudación mensual se consulta desde Supabase mediante /api/refrendos/recaudacion.
import { dailyRevenueCsv } from "../data/recaudacion-diaria";

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

export interface HistoricalData {
  year: number;
  total: number;
  month: number;
}

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

export interface HistoricalMonthlyData {
  monthName: string;
  monthIndex: number;
  year2021?: number;
  year2022?: number;
  year2023?: number;
  year2024?: number;
  year2025?: number;
  year2026?: number;
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
  privado: number;
}

// Optimized Parser for Financial Data (Executes once on module load)
const parseDailyRevenue = (): DailyRevenueData[] => {
  const records: Record<string, DailyRevenueData> = {};
  const lines = dailyRevenueCsv.trim().split('\n').slice(1);

  for (const line of lines) {
    const [concepto, fecha, montoStr] = line.split(',');
    const monto = parseInt(montoStr) || 0;
    
    if (!records[fecha]) {
      records[fecha] = { date: fecha, publico: 0, privado: 0 };
    }
    
    if (concepto.includes('PÚBLICO')) {
      records[fecha].publico += monto;
    } else {
      records[fecha].privado += monto;
    }
  }

  return Object.values(records).sort((a, b) => {
    const [d2, m2, y2] = b.date.split('/').map(Number);
    const [d1, m1, y1] = a.date.split('/').map(Number);
    return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
  });
};

const parsedDailyRevenueCache = parseDailyRevenue();

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

  const response = await fetch(`/api/refrendos?${params.toString()}`, {
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

export const fetchLiveTramiteData = async (): Promise<TramiteData[]> => {
  const dashboard = await fetchRefrendoDashboard({ year: 2026, page: 1, pageSize: 50 });
  return dashboard.dailyTrend.map((item) => {
    const date = new Date(`${item.fecha}T12:00:00`);
    return {
      date: `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`,
      fullDate: date,
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      dayOfWeek: '',
      total: Number(item.totalRegistros) || 0,
      digital: Number(item.digital) || 0,
      traditional: Number(item.tradicional) || 0,
      total2024: 0,
      total2025: 0,
    };
  });
};

type LegacyRefrendoRecord = Record<string, unknown>;

export const getProcessedData = (liveData: unknown[] = []): TramiteData[] => {
  if (!liveData || !Array.isArray(liveData)) return [];
  
  try {
    return liveData
      .filter((item): item is LegacyRefrendoRecord => (
        typeof item === 'object' && item !== null && 'mes' in item && 'dia' in item
      ))
      .map(item => {
        const dia = Number.parseInt(String(item.dia ?? '')) || 1;
        const mes = Number.parseInt(String(item.mes ?? '')) || 1;
        const anio = Number.parseInt(String(item.anio ?? '')) || 2026;
        
        return {
          date: `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}`,
          fullDate: new Date(anio, mes - 1, dia),
          day: dia,
          month: mes,
          year: anio,
          dayOfWeek: String(item.dia_semana ?? ''),
          total: Number.parseInt(String(item.total_registros ?? '')) || 0,
          digital: Number.parseInt(String(item.es_digital ?? '')) || 0,
          traditional: Number.parseInt(String(item.es_tradicional ?? '')) || 0,
          total2024: 0,
          total2025: 0,
          hora: item.hora != null ? Number.parseInt(String(item.hora)) : undefined
        };
      })
      .filter(item => !isNaN(item.fullDate.getTime()))
      .sort((a, b) => a.fullDate.getTime() - b.fullDate.getTime());
  } catch (err) {
    console.error('Error processing data:', err);
    return [];
  }
};

export const getHistoricalData = (month: number = 1, liveData: TramiteData[] = []): HistoricalData[] => {
  // Keeping essential comparison stats (Not CSV strings, but minimal objects)
  const stats: Record<number, HistoricalData[]> = {
    1: [{ year: 2021, total: 49087, month: 1 }, { year: 2022, total: 83339, month: 1 }, { year: 2023, total: 70757, month: 1 }, { year: 2024, total: 154704, month: 1 }, { year: 2025, total: 107708, month: 1 }, { year: 2026, total: 91936, month: 1 }],
    2: [{ year: 2021, total: 55560, month: 2 }, { year: 2022, total: 83680, month: 2 }, { year: 2023, total: 53926, month: 2 }, { year: 2024, total: 88595, month: 2 }, { year: 2025, total: 21388, month: 2 }, { year: 2026, total: 81036, month: 2 }],
    3: [{ year: 2021, total: 87610, month: 3 }, { year: 2022, total: 110064, month: 3 }, { year: 2023, total: 56645, month: 3 }, { year: 2024, total: 82565, month: 3 }, { year: 2025, total: 55524, month: 3 }, { year: 2026, total: 88447, month: 3 }],
    4: [{ year: 2026, total: 60283, month: 4 }],
    5: [{ year: 2026, total: 3489, month: 5 }],
    6: [{ year: 2026, total: 111, month: 6 }],
    7: [{ year: 2026, total: 0, month: 7 }],
  };

  const monthStats = stats[month] || [];

  // If we have live data, dynamically update the 2026 value
  if (liveData && liveData.length > 0) {
    const liveMonthTotal = liveData
      .filter(d => d.month === month && d.year === 2026)
      .reduce((acc, curr) => acc + curr.total, 0);

    const entry2026 = monthStats.find(d => d.year === 2026);
    if (entry2026) {
      entry2026.total = liveMonthTotal || entry2026.total;
    } else if (liveMonthTotal > 0) {
      monthStats.push({ year: 2026, total: liveMonthTotal, month });
    }
  }

  return monthStats;
};

export const getHistoricalMonthlyData = (liveData: TramiteData[] = []): HistoricalMonthlyData[] => {
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  
  // Calculate dynamic monthly totals for 2026 from live data if available
  const liveTotals: Record<number, number> = {};
  if (liveData && liveData.length > 0) {
    liveData.forEach(d => {
      if (d.year === 2026) {
        liveTotals[d.month] = (liveTotals[d.month] || 0) + d.total;
      }
    });
  }

  return months.map((name, i) => {
    const monthIndex = i + 1;
    const year2026Val = liveTotals[monthIndex] !== undefined
      ? liveTotals[monthIndex]
      : monthIndex === 1 ? 91936 
                  : monthIndex === 2 ? 81036 
                  : monthIndex === 3 ? 88447 
                  : monthIndex === 4 ? 60283 
                  : monthIndex === 5 ? 3489 
                  : monthIndex === 6 ? 111 
                  : 0;

    return {
      monthName: name,
      monthIndex,
      year2026: year2026Val
    };
  });
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
      if (!cutoffDate || row.fecha_corte > cutoffDate) {
        cutoffDate = row.fecha_corte;
      }
    }

    cri ??= row.cri;
    concepto ??= row.concepto;
  }

  return { months, years, activeYear, cutoffDate, cri, concepto };
}

export async function fetchRecaudacionDashboard(
  signal?: AbortSignal,
  endpoint = "/api/refrendos/recaudacion",
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

export const getGestoresData = (): GestorData[] => [
  { month: 'Enero', year: 2026, fullLabel: 'Ene 2026', gestores: 10410, totalGeneral: 91936 },
  { month: 'Febrero', year: 2026, fullLabel: 'Feb 2026', gestores: 3, totalGeneral: 7576 },
];

const getRevenueByMonth = (suffix: string) => parsedDailyRevenueCache.filter(d => d.date.endsWith(`/${suffix}/2026`));

export const getJanuaryRevenueData = () => getRevenueByMonth('01');
export const getFebruaryRevenueData = () => getRevenueByMonth('02');
export const getMarchRevenueData = () => getRevenueByMonth('03');
export const getAprilRevenueData = () => getRevenueByMonth('04');
export const getMayRevenueData = () => getRevenueByMonth('05');
export const getJuneRevenueData = () => getRevenueByMonth('06');
export const getJulyRevenueData = () => getRevenueByMonth('07');
export const getAugustRevenueData = () => getRevenueByMonth('08');

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
