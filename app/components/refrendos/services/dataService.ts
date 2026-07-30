// La recaudación mensual se consulta desde Supabase mediante /api/refrendos/recaudacion.
const dailyRevenueCsv = `concepto,fecha,monto
REFRENDO DE PLACAS SERVICIO PARTICULAR,01/01/2026,811438
REFRENDO DE PLACAS SERVICIO PARTICULAR,02/01/2026,2350076
REFRENDO DE PLACAS SERVICIO PARTICULAR,03/01/2026,1085834
REFRENDO DE PLACAS SERVICIO PARTICULAR,04/01/2026,1148188
REFRENDO DE PLACAS SERVICIO PARTICULAR,05/01/2026,5638798
REFRENDO DE PLACAS SERVICIO PARTICULAR,06/01/2026,7128927
REFRENDO DE PLACAS SERVICIO PARTICULAR,07/01/2026,7549406
REFRENDO DE PLACAS SERVICIO PARTICULAR,08/01/2026,9096820
REFRENDO DE PLACAS SERVICIO PARTICULAR,09/01/2026,7235142
REFRENDO DE PLACAS SERVICIO PARTICULAR,10/01/2026,1604361
REFRENDO DE PLACAS SERVICIO PARTICULAR,11/01/2026,1649044
REFRENDO DE PLACAS SERVICIO PARTICULAR,12/01/2026,8832327
REFRENDO DE PLACAS SERVICIO PARTICULAR,13/01/2026,7687262
REFRENDO DE PLACAS SERVICIO PARTICULAR,14/01/2026,8247989
REFRENDO DE PLACAS SERVICIO PARTICULAR,15/01/2026,8333563
REFRENDO DE PLACAS SERVICIO PARTICULAR,16/01/2026,6902034
REFRENDO DE PLACAS SERVICIO PARTICULAR,17/01/2026,1317431
REFRENDO DE PLACAS SERVICIO PARTICULAR,18/01/2026,1342471
REFRENDO DE PLACAS SERVICIO PARTICULAR,19/01/2026,6489519
REFRENDO DE PLACAS SERVICIO PARTICULAR,20/01/2026,7115791
REFRENDO DE PLACAS SERVICIO PARTICULAR,21/01/2026,7814447
REFRENDO DE PLACAS SERVICIO PARTICULAR,22/01/2026,7481848
REFRENDO DE PLACAS SERVICIO PARTICULAR,23/01/2026,6568013
REFRENDO DE PLACAS SERVICIO PARTICULAR,24/01/2026,1554264
REFRENDO DE PLACAS SERVICIO PARTICULAR,25/01/2026,1282344
REFRENDO DE PLACAS SERVICIO PARTICULAR,26/01/2026,6325726
REFRENDO DE PLACAS SERVICIO PARTICULAR,27/01/2026,7167378
REFRENDO DE PLACAS SERVICIO PARTICULAR,28/01/2026,9328254
REFRENDO DE PLACAS SERVICIO PARTICULAR,29/01/2026,7678979
REFRENDO DE PLACAS SERVICIO PARTICULAR,30/01/2026,8766794
REFRENDO DE PLACAS SERVICIO PARTICULAR,31/01/2026,3749658
REFRENDO DE PLACAS SERVICIO PARTICULAR,01/02/2026,770627
REFRENDO DE PLACAS SERVICIO PARTICULAR,02/02/2026,1528754
REFRENDO DE PLACAS SERVICIO PARTICULAR,03/02/2026,4584026
REFRENDO DE PLACAS SERVICIO PARTICULAR,04/02/2026,4847311
REFRENDO DE PLACAS SERVICIO PARTICULAR,05/02/2026,5321691
REFRENDO DE PLACAS SERVICIO PARTICULAR,06/02/2026,4324629
REFRENDO DE PLACAS SERVICIO PARTICULAR,07/02/2026,1218324
REFRENDO DE PLACAS SERVICIO PARTICULAR,08/02/2026,838084
REFRENDO DE PLACAS SERVICIO PARTICULAR,09/02/2026,5068297
REFRENDO DE PLACAS SERVICIO PARTICULAR,10/02/2026,4630550
REFRENDO DE PLACAS SERVICIO PARTICULAR,11/02/2026,5073044
REFRENDO DE PLACAS SERVICIO PARTICULAR,12/02/2026,4265184
REFRENDO DE PLACAS SERVICIO PARTICULAR,13/02/2026,3931702
REFRENDO DE PLACAS SERVICIO PARTICULAR,14/02/2026,969680
REFRENDO DE PLACAS SERVICIO PARTICULAR,15/02/2026,897300
REFRENDO DE PLACAS SERVICIO PARTICULAR,16/02/2026,4756135
REFRENDO DE PLACAS SERVICIO PARTICULAR,17/02/2026,4703608
REFRENDO DE PLACAS SERVICIO PARTICULAR,18/02/2026,5356527
REFRENDO DE PLACAS SERVICIO PARTICULAR,19/02/2026,5105027
REFRENDO DE PLACAS SERVICIO PARTICULAR,20/02/2026,4440777
REFRENDO DE PLACAS SERVICIO PARTICULAR,21/02/2026,1180349
REFRENDO DE PLACAS SERVICIO PARTICULAR,22/02/2026,810783
REFRENDO DE PLACAS SERVICIO PARTICULAR,23/02/2026,4929979
REFRENDO DE PLACAS SERVICIO PARTICULAR,24/02/2026,5137756
REFRENDO DE PLACAS SERVICIO PARTICULAR,25/02/2026,6088880
REFRENDO DE PLACAS SERVICIO PARTICULAR,26/02/2026,5001846
REFRENDO DE PLACAS SERVICIO PARTICULAR,27/02/2026,5702381
REFRENDO DE PLACAS SERVICIO PARTICULAR,28/02/2026,1854343
REFRENDO DE PLACAS SERVICIO PARTICULAR,01/03/2026,865618
REFRENDO DE PLACAS SERVICIO PARTICULAR,02/03/2026,3810756
REFRENDO DE PLACAS SERVICIO PARTICULAR,03/03/2026,4528100
REFRENDO DE PLACAS SERVICIO PARTICULAR,04/03/2026,3932415
REFRENDO DE PLACAS SERVICIO PARTICULAR,05/03/2026,3960560
REFRENDO DE PLACAS SERVICIO PARTICULAR,06/03/2026,3678732
REFRENDO DE PLACAS SERVICIO PARTICULAR,07/03/2026,1144602
REFRENDO DE PLACAS SERVICIO PARTICULAR,08/03/2026,924059
REFRENDO DE PLACAS SERVICIO PARTICULAR,09/03/2026,4786374
REFRENDO DE PLACAS SERVICIO PARTICULAR,10/03/2026,4511136
REFRENDO DE PLACAS SERVICIO PARTICULAR,11/03/2026,5176930
REFRENDO DE PLACAS SERVICIO PARTICULAR,12/03/2026,4271981
REFRENDO DE PLACAS SERVICIO PARTICULAR,13/03/2026,3921491
REFRENDO DE PLACAS SERVICIO PARTICULAR,14/03/2026,1119353
REFRENDO DE PLACAS SERVICIO PARTICULAR,15/03/2026,701642
REFRENDO DE PLACAS SERVICIO PARTICULAR,16/03/2026,1711986
REFRENDO DE PLACAS SERVICIO PARTICULAR,17/03/2026,4672253
REFRENDO DE PLACAS SERVICIO PARTICULAR,18/03/2026,5027930
REFRENDO DE PLACAS SERVICIO PARTICULAR,19/03/2026,5160746
REFRENDO DE PLACAS SERVICIO PARTICULAR,20/03/2026,4339969
REFRENDO DE PLACAS SERVICIO PARTICULAR,21/03/2026,1411262
REFRENDO DE PLACAS SERVICIO PARTICULAR,22/03/2026,1112198
REFRENDO DE PLACAS SERVICIO PARTICULAR,23/03/2026,6426844
REFRENDO DE PLACAS SERVICIO PARTICULAR,24/03/2026,6373087
REFRENDO DE PLACAS SERVICIO PARTICULAR,25/03/2026,6971986
REFRENDO DE PLACAS SERVICIO PARTICULAR,26/03/2026,6443737
REFRENDO DE PLACAS SERVICIO PARTICULAR,27/03/2026,7172114
REFRENDO DE PLACAS SERVICIO PARTICULAR,28/03/2026,2161332
REFRENDO DE PLACAS SERVICIO PARTICULAR,29/03/2026,1809051
REFRENDO DE PLACAS SERVICIO PARTICULAR,30/03/2026,6832349
REFRENDO DE PLACAS SERVICIO PARTICULAR,31/03/2026,11981564
REFRENDO DE PLACAS SERVICIO PARTICULAR,01/04/2026,11658236
REFRENDO DE PLACAS SERVICIO PARTICULAR,02/04/2026,2155040
REFRENDO DE PLACAS SERVICIO PARTICULAR,03/04/2026,921385
REFRENDO DE PLACAS SERVICIO PARTICULAR,04/04/2026,1088237
REFRENDO DE PLACAS SERVICIO PARTICULAR,05/04/2026,1006629
REFRENDO DE PLACAS SERVICIO PARTICULAR,06/04/2026,7280447
REFRENDO DE PLACAS SERVICIO PARTICULAR,07/04/2026,9525410
REFRENDO DE PLACAS SERVICIO PARTICULAR,08/04/2026,10303163
REFRENDO DE PLACAS SERVICIO PARTICULAR,09/04/2026,11464246
REFRENDO DE PLACAS SERVICIO PARTICULAR,10/04/2026,4343138
REFRENDO DE PLACAS SERVICIO PARTICULAR,11/04/2026,1115871
REFRENDO DE PLACAS SERVICIO PARTICULAR,12/04/2026,638963
REFRENDO DE PLACAS SERVICIO PARTICULAR,13/04/2026,10077415
REFRENDO DE PLACAS SERVICIO PARTICULAR,14/04/2026,11603864
REFRENDO DE PLACAS SERVICIO PARTICULAR,15/04/2026,11630694
REFRENDO DE PLACAS SERVICIO PARTICULAR,16/04/2026,9810384
REFRENDO DE PLACAS SERVICIO PARTICULAR,17/04/2026,10018583
REFRENDO DE PLACAS SERVICIO PARTICULAR,18/04/2026,1773613
REFRENDO DE PLACAS SERVICIO PARTICULAR,19/04/2026,1362362
REFRENDO DE PLACAS SERVICIO PARTICULAR,20/04/2026,8951935
REFRENDO DE PLACAS SERVICIO PARTICULAR,21/04/2026,11481022
REFRENDO DE PLACAS SERVICIO PARTICULAR,22/04/2026,11262230
REFRENDO DE PLACAS SERVICIO PARTICULAR,23/04/2026,10020522
REFRENDO DE PLACAS SERVICIO PARTICULAR,24/04/2026,8662711
REFRENDO DE PLACAS SERVICIO PARTICULAR,25/04/2026,3047089
REFRENDO DE PLACAS SERVICIO PARTICULAR,26/04/2026,991437
REFRENDO DE PLACAS SERVICIO PARTICULAR,27/04/2026,10743692
REFRENDO DE PLACAS SERVICIO PARTICULAR,28/04/2026,11676980
REFRENDO DE PLACAS SERVICIO PARTICULAR,29/04/2026,13560118
REFRENDO DE PLACAS SERVICIO PARTICULAR,30/04/2026,13188683
REFRENDO DE PLACAS SERVICIO PARTICULAR,01/05/2026,642590
REFRENDO DE PLACAS SERVICIO PARTICULAR,02/05/2026,507622
REFRENDO DE PLACAS SERVICIO PARTICULAR,03/05/2026,462010
REFRENDO DE PLACAS SERVICIO PARTICULAR,04/05/2026,1898871
REFRENDO DE PLACAS SERVICIO PARTICULAR,05/05/2026,6004052
REFRENDO DE PLACAS SERVICIO PARTICULAR,06/05/2026,1246714
REFRENDO DE PLACAS SERVICIO PÚBLICO,02/01/2026,735
REFRENDO DE PLACAS SERVICIO PÚBLICO,05/01/2026,735
REFRENDO DE PLACAS SERVICIO PÚBLICO,06/01/2026,13262
REFRENDO DE PLACAS SERVICIO PÚBLICO,07/01/2026,9555
REFRENDO DE PLACAS SERVICIO PÚBLICO,08/01/2026,11025
REFRENDO DE PLACAS SERVICIO PÚBLICO,09/01/2026,38268
REFRENDO DE PLACAS SERVICIO PÚBLICO,11/01/2026,3675
REFRENDO DE PLACAS SERVICIO PÚBLICO,12/01/2026,17704
REFRENDO DE PLACAS SERVICIO PÚBLICO,13/01/2026,19142
REFRENDO DE PLACAS SERVICIO PÚBLICO,14/01/2026,19917
REFRENDO DE PLACAS SERVICIO PÚBLICO,15/01/2026,14001
REFRENDO DE PLACAS SERVICIO PÚBLICO,16/01/2026,19126
REFRENDO DE PLACAS SERVICIO PÚBLICO,18/01/2026,1470
REFRENDO DE PLACAS SERVICIO PÚBLICO,19/01/2026,27417
REFRENDO DE PLACAS SERVICIO PÚBLICO,20/01/2026,18411
REFRENDO DE PLACAS SERVICIO PÚBLICO,21/01/2026,29550
REFRENDO DE PLACAS SERVICIO PÚBLICO,22/01/2026,37673
REFRENDO DE PLACAS SERVICIO PÚBLICO,23/01/2026,26460
REFRENDO DE PLACAS SERVICIO PÚBLICO,24/01/2026,4426
REFRENDO DE PLACAS SERVICIO PÚBLICO,25/01/2026,5880
REFRENDO DE PLACAS SERVICIO PÚBLICO,26/01/2026,55371
REFRENDO DE PLACAS SERVICIO PÚBLICO,27/01/2026,74015
REFRENDO DE PLACAS SERVICIO PÚBLICO,28/01/2026,105413
REFRENDO DE PLACAS SERVICIO PÚBLICO,29/01/2026,83337
REFRENDO DE PLACAS SERVICIO PÚBLICO,30/01/2026,120883
REFRENDO DE PLACAS SERVICIO PÚBLICO,31/01/2026,58065
REFRENDO DE PLACAS SERVICIO PÚBLICO,02/02/2026,9156
REFRENDO DE PLACAS SERVICIO PÚBLICO,03/02/2026,59388
REFRENDO DE PLACAS SERVICIO PÚBLICO,04/02/2026,75222
REFRENDO DE PLACAS SERVICIO PÚBLICO,05/02/2026,87503
REFRENDO DE PLACAS SERVICIO PÚBLICO,06/02/2026,46470
REFRENDO DE PLACAS SERVICIO PÚBLICO,07/02/2026,8351
REFRENDO DE PLACAS SERVICIO PÚBLICO,08/02/2026,1526
REFRENDO DE PLACAS SERVICIO PÚBLICO,09/02/2026,71618
REFRENDO DE PLACAS SERVICIO PÚBLICO,10/02/2026,51785
REFRENDO DE PLACAS SERVICIO PÚBLICO,11/02/2026,39632
REFRENDO DE PLACAS SERVICIO PÚBLICO,12/02/2026,31255
REFRENDO DE PLACAS SERVICIO PÚBLICO,13/02/2026,23619
REFRENDO DE PLACAS SERVICIO PÚBLICO,14/02/2026,3052
REFRENDO DE PLACAS SERVICIO PÚBLICO,16/02/2026,55615
REFRENDO DE PLACAS SERVICIO PÚBLICO,17/02/2026,59434
REFRENDO DE PLACAS SERVICIO PÚBLICO,18/02/2026,85392
REFRENDO DE PLACAS SERVICIO PÚBLICO,19/02/2026,70861
REFRENDO DE PLACAS SERVICIO PÚBLICO,20/02/2026,79258
REFRENDO DE PLACAS SERVICIO PÚBLICO,21/02/2026,3052
REFRENDO DE PLACAS SERVICIO PÚBLICO,22/02/2026,6104
REFRENDO DE PLACAS SERVICIO PÚBLICO,23/02/2026,71672
REFRENDO DE PLACAS SERVICIO PÚBLICO,24/02/2026,95280
REFRENDO DE PLACAS SERVICIO PÚBLICO,25/02/2026,93795
REFRENDO DE PLACAS SERVICIO PÚBLICO,26/02/2026,67815
REFRENDO DE PLACAS SERVICIO PÚBLICO,27/02/2026,71643
REFRENDO DE PLACAS SERVICIO PÚBLICO,28/02/2026,14488
REFRENDO DE PLACAS SERVICIO PÚBLICO,01/03/2026,6095
REFRENDO DE PLACAS SERVICIO PÚBLICO,02/03/2026,68557
REFRENDO DE PLACAS SERVICIO PÚBLICO,03/03/2026,63982
REFRENDO DE PLACAS SERVICIO PÚBLICO,04/03/2026,65546
REFRENDO DE PLACAS SERVICIO PÚBLICO,05/03/2026,95220
REFRENDO DE PLACAS SERVICIO PÚBLICO,06/03/2026,75470
REFRENDO DE PLACAS SERVICIO PÚBLICO,07/03/2026,763
REFRENDO DE PLACAS SERVICIO PÚBLICO,08/03/2026,2289
REFRENDO DE PLACAS SERVICIO PÚBLICO,09/03/2026,73111
REFRENDO DE PLACAS SERVICIO PÚBLICO,10/03/2026,71605
REFRENDO DE PLACAS SERVICIO PÚBLICO,11/03/2026,66317
REFRENDO DE PLACAS SERVICIO PÚBLICO,12/03/2026,57180
REFRENDO DE PLACAS SERVICIO PÚBLICO,13/03/2026,68642
REFRENDO DE PLACAS SERVICIO PÚBLICO,14/03/2026,6092
REFRENDO DE PLACAS SERVICIO PÚBLICO,15/03/2026,3052
REFRENDO DE PLACAS SERVICIO PÚBLICO,16/03/2026,7630
REFRENDO DE PLACAS SERVICIO PÚBLICO,17/03/2026,91495
REFRENDO DE PLACAS SERVICIO PÚBLICO,18/03/2026,73206
REFRENDO DE PLACAS SERVICIO PÚBLICO,19/03/2026,47292
REFRENDO DE PLACAS SERVICIO PÚBLICO,20/03/2026,59501
REFRENDO DE PLACAS SERVICIO PÚBLICO,21/03/2026,3052
REFRENDO DE PLACAS SERVICIO PÚBLICO,22/03/2026,763
REFRENDO DE PLACAS SERVICIO PÚBLICO,23/03/2026,72434
REFRENDO DE PLACAS SERVICIO PÚBLICO,24/03/2026,80083
REFRENDO DE PLACAS SERVICIO PÚBLICO,25/03/2026,77734
REFRENDO DE PLACAS SERVICIO PÚBLICO,26/03/2026,97606
REFRENDO DE PLACAS SERVICIO PÚBLICO,27/03/2026,120409
REFRENDO DE PLACAS SERVICIO PÚBLICO,28/03/2026,9156
REFRENDO DE PLACAS SERVICIO PÚBLICO,29/03/2026,8393
REFRENDO DE PLACAS SERVICIO PÚBLICO,30/03/2026,103647
REFRENDO DE PLACAS SERVICIO PÚBLICO,31/03/2026,138016
REFRENDO DE PLACAS SERVICIO PÚBLICO,01/04/2026,333687
REFRENDO DE PLACAS SERVICIO PÚBLICO,02/04/2026,11044
REFRENDO DE PLACAS SERVICIO PÚBLICO,03/04/2026,26646
REFRENDO DE PLACAS SERVICIO PÚBLICO,04/04/2026,1004
REFRENDO DE PLACAS SERVICIO PÚBLICO,05/04/2026,2008
REFRENDO DE PLACAS SERVICIO PÚBLICO,06/04/2026,281728
REFRENDO DE PLACAS SERVICIO PÚBLICO,07/04/2026,402565
REFRENDO DE PLACAS SERVICIO PÚBLICO,08/04/2026,617967
REFRENDO DE PLACAS SERVICIO PÚBLICO,09/04/2026,674913
REFRENDO DE PLACAS SERVICIO PÚBLICO,10/04/2026,118178
REFRENDO DE PLACAS SERVICIO PÚBLICO,11/04/2026,9072
REFRENDO DE PLACAS SERVICIO PÚBLICO,12/04/2026,11088
REFRENDO DE PLACAS SERVICIO PÚBLICO,13/04/2026,753517
REFRENDO DE PLACAS SERVICIO PÚBLICO,14/04/2026,333451
REFRENDO DE PLACAS SERVICIO PÚBLICO,15/04/2026,831585
REFRENDO DE PLACAS SERVICIO PÚBLICO,16/04/2026,522603
REFRENDO DE PLACAS SERVICIO PÚBLICO,17/04/2026,963269
REFRENDO DE PLACAS SERVICIO PÚBLICO,19/04/2026,3024
REFRENDO DE PLACAS SERVICIO PÚBLICO,20/04/2026,457821
REFRENDO DE PLACAS SERVICIO PÚBLICO,21/04/2026,489111
REFRENDO DE PLACAS SERVICIO PÚBLICO,22/04/2026,455002
REFRENDO DE PLACAS SERVICIO PÚBLICO,23/04/2026,610469
REFRENDO DE PLACAS SERVICIO PÚBLICO,24/04/2026,1113733
REFRENDO DE PLACAS SERVICIO PÚBLICO,25/04/2026,19320
REFRENDO DE PLACAS SERVICIO PÚBLICO,26/04/2026,15972
REFRENDO DE PLACAS SERVICIO PÚBLICO,27/04/2026,664602
REFRENDO DE PLACAS SERVICIO PÚBLICO,28/04/2026,886739
REFRENDO DE PLACAS SERVICIO PÚBLICO,29/04/2026,1044615
REFRENDO DE PLACAS SERVICIO PÚBLICO,30/04/2026,1809906
REFRENDO DE PLACAS SERVICIO PÚBLICO,01/05/2026,7070
REFRENDO DE PLACAS SERVICIO PÚBLICO,02/05/2026,8080
REFRENDO DE PLACAS SERVICIO PÚBLICO,03/05/2026,2020
REFRENDO DE PLACAS SERVICIO PÚBLICO,04/05/2026,4040
REFRENDO DE PLACAS SERVICIO PÚBLICO,05/05/2026,397685
REFRENDO DE PLACAS SERVICIO PÚBLICO,06/05/2026,129782`;

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

export const getProcessedData = (liveData: any[] = []): TramiteData[] => {
  if (!liveData || !Array.isArray(liveData)) return [];
  
  try {
    return liveData
      .filter(item => item && item.mes != null && item.dia != null)
      .map(item => {
        const dia = parseInt(item.dia) || 1;
        const mes = parseInt(item.mes) || 1;
        const anio = parseInt(item.anio) || 2026;
        
        return {
          date: `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}`,
          fullDate: new Date(anio, mes - 1, dia),
          day: dia,
          month: mes,
          year: anio,
          dayOfWeek: item.dia_semana || '',
          total: parseInt(item.total_registros) || 0,
          digital: parseInt(item.es_digital) || 0,
          traditional: parseInt(item.es_tradicional) || 0,
          total2024: 0,
          total2025: 0,
          hora: item.hora != null ? parseInt(item.hora) : undefined
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
    let year2026Val = 0;
    
    if (liveTotals[monthIndex] !== undefined) {
      year2026Val = liveTotals[monthIndex];
    } else {
      year2026Val = monthIndex === 1 ? 91936 
                  : monthIndex === 2 ? 81036 
                  : monthIndex === 3 ? 88447 
                  : monthIndex === 4 ? 60283 
                  : monthIndex === 5 ? 3489 
                  : monthIndex === 6 ? 111 
                  : 0;
    }

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
): Promise<RecaudacionDashboardData> {
  const response = await fetch("/api/refrendos/recaudacion", {
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
