"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  Calendar,
  Loader2,
  MapPin,
  RefreshCw,
  MessageSquare,
  Star,
  ThumbsUp,
  Users,
} from "lucide-react";
import { RecordsSectionHeader } from "@/features/dashboards/shared/components/RecordsSectionHeader";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartVisibilityProvider, SafeResponsiveContainer } from "@/components/ui/SafeResponsiveContainer";
import {
  DashboardUpdateNotice,
  type DashboardUpdateNoticeValue,
} from "@/features/dashboards/shared/components/DashboardUpdateNotice";
import { downloadCsv } from "@/features/dashboards/shared/lib/csv";
import {
  FilterChip,
  LegendRow,
  MetricCard,
  NpsTooltip,
  SearchableFilterSelect,
  SortHeader,
} from "@/features/dashboards/modules/nps/components/NpsDashboardParts";
import {
  dateInputValue,
  displayDate,
  monthLabel,
  normalizeOptions,
  rangeFromMonth,
  wait,
} from "@/features/dashboards/modules/nps/lib/dashboard";
import type { NpsSortDirection as SortDirection, NpsSortKey } from "@/features/dashboards/modules/nps/types";

type RecommendationFilter = "" | "yes" | "no";

type NpsComment = {
  submit_id: number;
  survey_name: string;
  dependencia: string;
  sucursal_branch: string;
  survey_submitted_at: string;
  comentario_libre: string;
  recomienda_citas: boolean;
  estrellas_facilidad_uso: number;
  estrellas_trato_personal: number;
  score: number;
};

type DashboardResponse = {
  metrics: {
    total: number;
    nps: number;
    facilidad: number;
    trato: number;
    promotores: number;
    detractores: number;
  };
  trend: Array<{ month: string; monthStart?: string; nps: number; total: number }>;
  dependencias: string[];
  sucursales: string[];
  comments: NpsComment[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

const EMPTY_RESPONSE: DashboardResponse = {
  metrics: { total: 0, nps: 0, facilidad: 0, trato: 0, promotores: 0, detractores: 0 },
  trend: [],
  dependencias: [],
  sucursales: [],
  comments: [],
  pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 },
};

const DASHBOARD_YEAR = 2026;
const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
] as const;

const MONTHS = createVisibleMonths(DASHBOARD_YEAR);

const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

function createVisibleMonths(year: number, today = new Date()) {
  const visibleCount = today.getFullYear() < year
    ? 0
    : today.getFullYear() > year
      ? 12
      : today.getMonth() + 1;

  return MONTH_NAMES.slice(0, visibleCount).map((label, monthIndex) => {
    const month = String(monthIndex + 1).padStart(2, "0");
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    return {
      label,
      start: `${year}-${month}-01`,
      end: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
    };
  });
}

export function NpsDashboard({
  isActive = true,
  csrfToken,
  canUpdate = false,
}: {
  isActive?: boolean;
  csrfToken: string;
  canUpdate?: boolean;
}) {
  const [dashboard, setDashboard] = useState<DashboardResponse>(EMPTY_RESPONSE);
  const [selectedDependencia, setSelectedDependencia] = useState("");
  const [selectedSucursal, setSelectedSucursal] = useState("");
  const [selectedRecommendation, setSelectedRecommendation] = useState<RecommendationFilter>("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<NpsSortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringUpdate, setTriggeringUpdate] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<DashboardUpdateNoticeValue | null>(null);
  const [exporting, setExporting] = useState(false);
  const [recordsVisible, setRecordsVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: "50",
        sort: sortKey,
        direction: sortDirection,
        refresh: String(Date.now()),
      });
      if (selectedDependencia) params.set("dependencia", selectedDependencia);
      if (selectedSucursal) params.set("sucursal", selectedSucursal);
      if (selectedRecommendation) params.set("recomienda", selectedRecommendation);
      if (dateRange.start) params.set("dateFrom", dateRange.start);
      if (dateRange.end) params.set("dateTo", dateRange.end);

      const response = await fetch(`/api/dashboards/dashboard-nps?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });
      const payload = (await response.json()) as DashboardResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No fue posible consultar NPS.");
      setDashboard(payload);
      setError(null);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") {
        setError((requestError as Error).message);
      }
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [selectedDependencia, selectedSucursal, selectedRecommendation, dateRange.start, dateRange.end, page, sortKey, sortDirection]);

  useEffect(() => {
    if (!isActive) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadDashboard(controller.signal);
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isActive, loadDashboard]);

  useEffect(() => {
    if (!isActive) return;

    const interval = window.setInterval(() => {
      void loadDashboard();
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [isActive, loadDashboard]);

  const trendData = useMemo(
    () => dashboard.trend.map((row) => ({
      ...row,
      monthLabel: monthLabel(row.month),
    })),
    [dashboard.trend],
  );

  const recommendationTotal = dashboard.metrics.promotores + dashboard.metrics.detractores;
  const recommendationPercentage = recommendationTotal
    ? Math.round((dashboard.metrics.promotores / recommendationTotal) * 100)
    : 0;

  const dependenciaOptions = useMemo(
    () => normalizeOptions(dashboard.dependencias),
    [dashboard.dependencias],
  );
  const sucursalOptions = useMemo(
    () => normalizeOptions(dashboard.sucursales),
    [dashboard.sucursales],
  );

  function selectMonth(start: string, end: string) {
    setDateRange({ start, end });
    setPage(1);
  }

  function selectTrendMonth(month: string) {
    const range = rangeFromMonth(month);
    if (!range) return;
    setDateRange(range);
    setPage(1);
  }

  function selectRecommendation(value: RecommendationFilter) {
    setSelectedRecommendation((current) => current === value ? "" : value);
    setPage(1);
  }

  function selectCommentRow(entry: NpsComment) {
    setSelectedDependencia(entry.dependencia);
    setSelectedSucursal(entry.sucursal_branch);
    setSelectedRecommendation(entry.recomienda_citas ? "yes" : "no");
    const selectedDate = dateInputValue(entry.survey_submitted_at);
    setDateRange({ start: selectedDate, end: selectedDate });
    setPage(1);
  }

  function toggleSort(key: NpsSortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "date" ? "desc" : "asc");
  }

  function resetFilters() {
    setSelectedDependencia("");
    setSelectedSucursal("");
    setSelectedRecommendation("");
    setDateRange({ start: "", end: "" });
    setPage(1);
  }

  async function refreshNpsData() {
    if (triggeringUpdate || !canUpdate) return;

    setTriggeringUpdate(true);
    setUpdateNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/dashboards/dashboard-nps/refresh", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No fue posible ejecutar la actualización de NPS.");
      }

      await wait(1200);
      await loadDashboard();
      setUpdateNotice({
        type: "success",
        message: "NPS actualizado correctamente.",
      });
    } catch {
      setUpdateNotice({
        type: "error",
        message: "No fue posible actualizar NPS.",
      });
    } finally {
      setTriggeringUpdate(false);
    }
  }

  async function exportFilteredRecords() {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort: sortKey, direction: sortDirection });
      if (selectedDependencia) params.set("dependencia", selectedDependencia);
      if (selectedSucursal) params.set("sucursal", selectedSucursal);
      if (selectedRecommendation) params.set("recomienda", selectedRecommendation);
      if (dateRange.start) params.set("dateFrom", dateRange.start);
      if (dateRange.end) params.set("dateTo", dateRange.end);

      const response = await fetch(`/api/dashboards/dashboard-nps/export?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as NpsComment[] | { error?: string };
      if (!response.ok) {
        const errorPayload = payload as { error?: string };
        throw new Error(errorPayload.error || "No fue posible exportar NPS.");
      }

      const records = payload as NpsComment[];
      const headers = [
        "ID encuesta",
        "Fecha",
        "Dependencia",
        "Sucursal",
        "Comentario",
        "Recomienda",
        "Facilidad",
        "Trato",
        "Puntuación",
      ];
      const rows = records.map((entry) => [
        entry.submit_id,
        displayDate(entry.survey_submitted_at),
        entry.dependencia,
        entry.sucursal_branch,
        entry.comentario_libre,
        entry.recomienda_citas ? "Sí" : "No",
        entry.estrellas_facilidad_uso,
        entry.estrellas_trato_personal,
        Number(entry.score).toFixed(1),
      ]);
      downloadCsv(`nps_registros_filtrados_${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
    } catch (exportError) {
      setError((exportError as Error).message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <ChartVisibilityProvider active={isActive}>
      <div className="min-h-screen bg-[#f5f4f0] text-[#1f2d1f]">
      <header className="dashboard-sticky-header sticky border-b border-[#e6e4da] bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:px-5 sm:py-4 lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#526647] shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl">
              <Activity className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-lg font-bold leading-tight text-[#1f2d1f] sm:text-2xl">Encuestas de satisfacción de citas</h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#7a8176] sm:text-[11px]">Panel NPS</p>
            </div>
          </div>

          <div className="flex w-full min-w-0 flex-col gap-3 xl:w-auto xl:flex-row xl:items-center">
            <div className="scrollbar-hide -mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 pb-1 xl:mx-0 xl:gap-2 xl:px-0">
              <button
                type="button"
                onClick={() => selectMonth("", "")}
                className={`flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm ${
                  !dateRange.start && !dateRange.end
                    ? "border-[#526647] text-[#526647]"
                    : "border-transparent text-[#61685d] hover:border-[#bbc5b3] hover:text-[#526647]"
                }`}
              >
                <Calendar className="h-4 w-4" />
                Todos
              </button>
              {MONTHS.map((month) => {
                const active = dateRange.start === month.start && dateRange.end === month.end;
                return (
                  <button
                    key={month.label}
                    type="button"
                    onClick={() => selectMonth(month.start, month.end)}
                    className={`flex min-h-10 shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2 text-xs font-semibold transition sm:gap-2 sm:px-3 sm:text-sm ${
                      active
                        ? "border-[#526647] text-[#526647]"
                        : "border-transparent text-[#61685d] hover:border-[#bbc5b3] hover:text-[#526647]"
                    }`}
                  >
                    <Calendar className="h-4 w-4" />
                    {month.label}
                  </button>
                );
              })}
            </div>

            {canUpdate && (
              <button
                type="button"
                onClick={() => void refreshNpsData()}
                disabled={triggeringUpdate}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#526647] px-5 py-2.5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-sm transition hover:bg-[#46583d] disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
                title="Solicitar la actualización protegida y volver a consultar los datos de NPS"
              >
                {triggeringUpdate ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {triggeringUpdate ? "Actualizando…" : "Actualizar"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-7 lg:px-6 lg:py-8">
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#e8cbd1] bg-[#fff5f7] px-5 py-4 text-[#833947]">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        <DashboardUpdateNotice
          notice={updateNotice}
          onDismiss={() => setUpdateNotice(null)}
        />

        <section className="relative rounded-2xl border border-[#e5e1d6] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-6">
          {refreshing && (
            <div className="mb-4 flex justify-end">
              <div className="flex items-center gap-2 rounded-full bg-[#f1f3ed] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#526647]">
                <Loader2 className="h-3 w-3 animate-spin" /> Actualizando
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-[1fr_1fr_1.35fr_auto]">
            <SearchableFilterSelect
              label="Dependencia"
              icon={<Building2 className="h-3.5 w-3.5 text-[#526647]" />}
              value={selectedDependencia}
              onChange={(value) => {
                setSelectedDependencia(value);
                setSelectedSucursal("");
                setPage(1);
              }}
              options={dependenciaOptions}
              allLabel="Todas las dependencias"
            />
            <SearchableFilterSelect
              label={`Sucursal (${sucursalOptions.length})`}
              icon={<MapPin className="h-3.5 w-3.5 text-[#8b3c43]" />}
              value={selectedSucursal}
              onChange={(value) => {
                setSelectedSucursal(value);
                setPage(1);
              }}
              options={sucursalOptions}
              allLabel="Todas las sucursales"
            />
            <div className="space-y-2 sm:col-span-2 xl:col-span-1">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#566151]">
                <Calendar className="h-3.5 w-3.5 text-[#526647]" /> Rango de fecha
              </label>
              <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] min-[480px]:items-center">
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(event) => {
                    setDateRange((current) => ({ ...current, start: event.target.value }));
                    setPage(1);
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-[#e3dfd3] bg-[#fbfaf7] px-4 py-3 text-sm outline-none transition focus:border-[#526647] focus:ring-4 focus:ring-[#526647]/10"
                />
                <span className="hidden text-[#81877d] min-[480px]:block">—</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(event) => {
                    setDateRange((current) => ({ ...current, end: event.target.value }));
                    setPage(1);
                  }}
                  className="min-w-0 flex-1 rounded-2xl border border-[#e3dfd3] bg-[#fbfaf7] px-4 py-3 text-sm outline-none transition focus:border-[#526647] focus:ring-4 focus:ring-[#526647]/10"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={resetFilters}
              className="h-[48px] w-full self-end rounded-full border border-[#ddd9cd] bg-[#f4f2ec] px-6 text-xs font-black uppercase tracking-[0.18em] text-[#526647] transition hover:bg-[#ebe8de] sm:w-auto xl:w-full"
            >
              Limpiar
            </button>
          </div>
          {(selectedDependencia || selectedSucursal || selectedRecommendation || dateRange.start || dateRange.end) && (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[#ece9df] pt-4 text-xs text-[#687166]">
              <span className="font-bold text-[#526647]">Filtros activos:</span>
              {selectedDependencia && <FilterChip label={selectedDependencia} onRemove={() => { setSelectedDependencia(""); setSelectedSucursal(""); setPage(1); }} />}
              {selectedSucursal && <FilterChip label={selectedSucursal} onRemove={() => { setSelectedSucursal(""); setPage(1); }} />}
              {selectedRecommendation && <FilterChip label={selectedRecommendation === "yes" ? "Sí recomienda" : "No recomienda"} onRemove={() => { setSelectedRecommendation(""); setPage(1); }} />}
              {(dateRange.start || dateRange.end) && <FilterChip label={`${dateRange.start || "Inicio"} — ${dateRange.end || "Fin"}`} onRemove={() => { setDateRange({ start: "", end: "" }); setPage(1); }} />}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
          <MetricCard title="Net Promoter Score" value={dashboard.metrics.nps} unit="%" note="Nivel de recomendación" icon={<ThumbsUp />} accent="#526647" />
          <MetricCard title="Escala facilidad" value={dashboard.metrics.facilidad} unit="/ 5" note="Facilidad para agendar" icon={<Star />} accent="#8b3c43" />
          <MetricCard title="Trato al usuario" value={dashboard.metrics.trato} unit="/ 5" note="Calidad percibida" icon={<Users />} accent="#526647" />
          <MetricCard title="Muestra total" value={dashboard.metrics.total.toLocaleString("es-MX")} unit="" note="Encuestas filtradas" icon={<MessageSquare />} accent="#9aa29a" />
        </section>

        <section className="grid grid-cols-1 gap-5 sm:gap-7 xl:grid-cols-[minmax(0,2fr)_minmax(320px,0.95fr)]">
          <article className="min-w-0 rounded-2xl border border-[#e5e1d6] bg-white p-4 shadow-sm sm:rounded-[30px] sm:p-7">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#526647]">Tendencia</p>
                <h2 className="text-xl font-bold text-[#1f2d1f]">Evolución de satisfacción</h2>
              </div>
              <span className="rounded-full bg-[#f1f3ed] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#526647]">Promedio mensual</span>
            </div>
            <div className="h-[280px] w-full min-w-0 sm:h-[340px] lg:h-[390px]">
              <SafeResponsiveContainer>
                <AreaChart
                  data={trendData}
                  margin={{ top: 15, right: 18, left: -12, bottom: 5 }}
                  onClick={(state) => {
                    const index = typeof state?.activeTooltipIndex === "number"
                      ? state.activeTooltipIndex
                      : -1;
                    const row = index >= 0 ? trendData[index] : undefined;
                    if (row?.month) selectTrendMonth(row.month);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <defs>
                    <linearGradient id="npsArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#526647" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#526647" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="#e9e6dc" strokeDasharray="4 6" />
                  <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fill: "#667064", fontSize: 10 }} dy={10} />
                  <YAxis domain={[-100, 100]} axisLine={false} tickLine={false} tick={{ fill: "#667064", fontSize: 10 }} width={38} />
                  <Tooltip content={<NpsTooltip />} cursor={{ stroke: "#aeb8a6", strokeDasharray: "4 4" }} />
                  <Area
                    type="monotone"
                    dataKey="nps"
                    stroke="#526647"
                    strokeWidth={4}
                    fill="url(#npsArea)"
                    activeDot={{ r: 7, fill: "#526647", stroke: "#fff", strokeWidth: 3 }}
                    dot={{ r: 4, fill: "#fff", stroke: "#526647", strokeWidth: 3 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </SafeResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-[#e5e1d6] bg-white p-4 shadow-sm sm:rounded-[30px] sm:p-7">
            <div className="text-center">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#526647]">Recomendación</p>
              <h2 className="text-xl font-bold text-[#1f2d1f]">Distribución de respuestas</h2>
            </div>
            <div className="relative mx-auto h-[240px] w-full max-w-[310px] sm:h-[280px] sm:max-w-[330px]">
              <SafeResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Sí recomienda", value: dashboard.metrics.promotores, filter: "yes" },
                      { name: "No recomienda", value: dashboard.metrics.detractores, filter: "no" },
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius="63%"
                    outerRadius="82%"
                    paddingAngle={4}
                    cornerRadius={8}
                    stroke="none"
                    isAnimationActive={false}
                    onClick={(entry) => selectRecommendation(entry.filter as RecommendationFilter)}
                    style={{ cursor: "pointer" }}
                  >
                    <Cell fill="#526647" />
                    <Cell fill="#8b3c43" />
                  </Pie>
                  <Tooltip formatter={(value) => Number(value).toLocaleString("es-MX")} />
                </PieChart>
              </SafeResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <strong className="text-4xl text-[#1f2d1f]">{recommendationPercentage}%</strong>
                <span className="mt-1 text-[10px] font-black uppercase tracking-wider text-[#7a8176]">Recomienda</span>
              </div>
            </div>
            <div className="space-y-3 border-t border-[#ece9df] pt-5">
              <LegendRow color="#526647" label="Sí recomienda" value={dashboard.metrics.promotores} />
              <LegendRow color="#8b3c43" label="No recomienda" value={dashboard.metrics.detractores} />
            </div>
          </article>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#e5e1d6] bg-white shadow-sm sm:rounded-[30px]">
          <RecordsSectionHeader
            title="Registro de comentarios"
            pageSize={dashboard.pagination.pageSize}
            total={dashboard.pagination.total}
            visible={recordsVisible}
            controlsId="nps-records-content"
            exporting={exporting}
            onToggle={() => setRecordsVisible((current) => !current)}
            onExport={() => void exportFilteredRecords()}
          />

          {recordsVisible && (
            <div id="nps-records-content">
              <div className="divide-y divide-[#ece9df] md:hidden">
            {dashboard.comments.map((entry) => (
              <button
                key={entry.submit_id}
                type="button"
                onClick={() => selectCommentRow(entry)}
                className="mobile-data-card"
                title="Seleccionar este registro como filtro"
              >
                <div className="mobile-data-card__top">
                  <div className="min-w-0">
                    <strong className="block break-words text-sm text-[#1f2d1f]">{entry.dependencia}</strong>
                    <span className="mt-1 block break-words text-[10px] font-bold uppercase text-[#8a9188]">{entry.sucursal_branch}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#f4f2ec] px-3 py-1.5 text-xs font-bold text-[#1f2d1f]">
                    {Number(entry.score).toFixed(1)} ★
                  </span>
                </div>
                <p className="m-0 line-clamp-3 text-sm leading-relaxed text-[#4f5850]">
                  {entry.comentario_libre || "Sin comentarios"}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold text-[#687166]">
                  <time>{displayDate(entry.survey_submitted_at)}</time>
                  <span className={entry.recomienda_citas ? "text-[#526647]" : "text-[#8b3c43]"}>
                    {entry.recomienda_citas ? "Sí recomienda" : "No recomienda"}
                  </span>
                </div>
              </button>
            ))}
            {dashboard.comments.length === 0 && (
              <div className="px-5 py-12 text-center text-sm text-[#7a8176]">No hay comentarios para los filtros seleccionados.</div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="bg-[#eeede4]">
                  <SortHeader label="Fecha" column="date" active={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortHeader label="Dependencia" column="dependencia" active={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortHeader label="Comentario" column="feedback" active={sortKey} direction={sortDirection} onSort={toggleSort} />
                  <SortHeader label="Métricas" column="score" active={sortKey} direction={sortDirection} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ece9df]">
                {dashboard.comments.map((entry) => (
                  <tr key={entry.submit_id} onClick={() => selectCommentRow(entry)} className="cursor-pointer transition hover:bg-[#f3f5ef] focus-within:bg-[#f3f5ef]" title="Seleccionar este registro como filtro">
                    <td className="whitespace-nowrap px-6 py-5 text-xs font-semibold text-[#687166]">{displayDate(entry.survey_submitted_at)}</td>
                    <td className="px-6 py-5">
                      <strong className="block max-w-[260px] truncate text-sm text-[#1f2d1f]">{entry.dependencia}</strong>
                      <span className="mt-1 block max-w-[260px] truncate text-[10px] font-bold uppercase text-[#9aa19a]">{entry.sucursal_branch}</span>
                    </td>
                    <td className="px-6 py-5 text-sm leading-relaxed text-[#4f5850]">
                      {entry.comentario_libre || <em className="text-[#9aa19a]">Sin comentarios</em>}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[#f4f2ec] px-3 py-1.5 text-xs font-bold text-[#1f2d1f]">
                        {Number(entry.score).toFixed(1)} <Star className="h-3.5 w-3.5 fill-[#d9a928] text-[#d9a928]" />
                      </span>
                    </td>
                  </tr>
                ))}
                {dashboard.comments.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-14 text-center text-sm text-[#7a8176]">No hay comentarios para los filtros seleccionados.</td></tr>
                )}
              </tbody>
            </table>
          </div>

              <div className="flex flex-col items-stretch justify-between gap-3 border-t border-[#ece9df] bg-[#faf9f5] px-4 py-4 sm:flex-row sm:items-center sm:px-7">
                <span className="text-xs font-semibold text-[#7a8176]">Página {dashboard.pagination.page} de {Math.max(1, dashboard.pagination.totalPages)}</span>
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-11 rounded-full border border-[#ddd9cd] bg-white px-4 py-2 text-xs font-bold text-[#526647] disabled:opacity-50">Anterior</button>
                  <button type="button" disabled={page >= dashboard.pagination.totalPages} onClick={() => setPage((current) => Math.min(dashboard.pagination.totalPages, current + 1))} className="min-h-11 rounded-full border border-[#ddd9cd] bg-white px-4 py-2 text-xs font-bold text-[#526647] disabled:opacity-50">Siguiente</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
      </div>
    </ChartVisibilityProvider>
  );
}
