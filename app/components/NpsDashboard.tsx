"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  AlertCircle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Loader2,
  MapPin,
  MessageSquare,
  Star,
  ThumbsUp,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "./npsDateUtils";
import { SmoothFilterSelect } from "./SmoothFilterSelect";

export type NpsSortKey = "date" | "dependencia" | "feedback" | "score";
type SortDirection = "asc" | "desc";
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
  pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
};

const MONTHS = [
  { label: "Enero", start: "2026-01-01", end: "2026-01-31" },
  { label: "Febrero", start: "2026-02-01", end: "2026-02-28" },
  { label: "Marzo", start: "2026-03-01", end: "2026-03-31" },
  { label: "Abril", start: "2026-04-01", end: "2026-04-30" },
  { label: "Mayo", start: "2026-05-01", end: "2026-05-31" },
  { label: "Junio", start: "2026-06-01", end: "2026-06-30" },
  { label: "Julio", start: "2026-07-01", end: "2026-07-31" },
] as const;

export function NpsDashboard() {
  const [dashboard, setDashboard] = useState<DashboardResponse>(EMPTY_RESPONSE);
  const [selectedDependencia, setSelectedDependencia] = useState("");
  const [selectedSucursal, setSelectedSucursal] = useState("");
  const [selectedRecommendation, setSelectedRecommendation] = useState<RecommendationFilter>("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<NpsSortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [recordsVisible, setRecordsVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setRefreshing(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: "20",
          sort: sortKey,
          direction: sortDirection,
        });
        if (selectedDependencia) params.set("dependencia", selectedDependencia);
        if (selectedSucursal) params.set("sucursal", selectedSucursal);
        if (selectedRecommendation) params.set("recomienda", selectedRecommendation);
        if (dateRange.start) params.set("dateFrom", dateRange.start);
        if (dateRange.end) params.set("dateTo", dateRange.end);

        const response = await fetch(`/api/survey-data?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "No fue posible consultar NPS.");
        setDashboard(payload as DashboardResponse);
        setError(null);
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setError((requestError as Error).message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [selectedDependencia, selectedSucursal, selectedRecommendation, dateRange.start, dateRange.end, page, sortKey, sortDirection]);

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

      const response = await fetch(`/api/nps/export?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No fue posible exportar NPS.");

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

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f4f0]">
        <div className="flex items-center gap-3 text-[#526647]">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="font-semibold">Cargando tablero NPS…</span>
        </div>
      </div>
    );
  }

  return (
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

          <div className="scrollbar-hide -mx-1 flex w-full max-w-full items-center gap-1 overflow-x-auto px-1 pb-1 xl:mx-0 xl:w-auto xl:gap-2 xl:px-0">
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
        </div>
      </header>

      <main className="w-full space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-7 lg:px-6 lg:py-8">
        {error && (
          <div className="flex items-center gap-3 rounded-2xl border border-[#e8cbd1] bg-[#fff5f7] px-5 py-4 text-[#833947]">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

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
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trendData}
                  margin={{ top: 15, right: 18, left: -12, bottom: 5 }}
                  onClick={(state) => {
                    const row = state?.activePayload?.[0]?.payload as { month?: string } | undefined;
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
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-[#e5e1d6] bg-white p-4 shadow-sm sm:rounded-[30px] sm:p-7">
            <div className="text-center">
              <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#526647]">Recomendación</p>
              <h2 className="text-xl font-bold text-[#1f2d1f]">Distribución de respuestas</h2>
            </div>
            <div className="relative mx-auto h-[240px] w-full max-w-[310px] sm:h-[280px] sm:max-w-[330px]">
              <ResponsiveContainer width="100%" height="100%">
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
              </ResponsiveContainer>
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
          <div className="flex flex-col items-stretch justify-between gap-4 border-b border-[#ece9df] px-4 py-5 sm:flex-row sm:items-center sm:px-7">
            <div>
              <h2 className="text-xl font-bold text-[#1f2d1f]">Registro de comentarios</h2>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#7a8176]">Voz del usuario en tiempo real</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                type="button"
                onClick={() => setRecordsVisible((current) => !current)}
                aria-expanded={recordsVisible}
                aria-controls="nps-records-content"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[#ddd9cd] bg-white px-4 py-2 text-xs font-bold text-[#526647] hover:bg-[#f7f6f1] sm:w-auto"
              >
                {recordsVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {recordsVisible ? "Ocultar tabla" : "Mostrar tabla"}
              </button>
              <button type="button" disabled={exporting} onClick={() => void exportFilteredRecords()} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#f1f3ed] px-4 py-2 text-xs font-bold text-[#526647] hover:bg-[#e8ece3] disabled:opacity-60 sm:w-auto">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Exportar todos los filtrados
              </button>
              <span className="rounded-full bg-[#f4f2ec] px-4 py-2 text-[10px] font-black uppercase tracking-wider text-[#6d746b]">
                {dashboard.pagination.total.toLocaleString("es-MX")} registros
              </span>
            </div>
          </div>

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
                <span className="text-xs font-semibold text-[#7a8176]">Página {dashboard.pagination.page} de {dashboard.pagination.totalPages}</span>
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
  );
}

function SearchableFilterSelect({
  label,
  icon,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#566151]">{icon}{label}</label>
      <SmoothFilterSelect
        value={value}
        onChange={onChange}
        options={options.map((option) => ({ value: option, label: option }))}
        placeholder={allLabel}
        ariaLabel={label}
        searchable
      />
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#f1f3ed] px-3 py-1.5 font-semibold text-[#526647]">
      <span className="max-w-[280px] truncate">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Quitar filtro ${label}`} className="rounded-full hover:bg-white/80">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function MetricCard({ title, value, unit, note, icon, accent }: { title: string; value: string | number; unit: string; note: string; icon: ReactNode; accent: string }) {
  return (
    <article className="group relative min-h-[165px] overflow-hidden rounded-2xl border border-[#e5e1d6] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:min-h-[185px] sm:rounded-[26px] sm:p-6">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-[#566151]">{title}</h3>
          <div className="mt-6 flex items-baseline gap-1">
            <strong className="text-4xl leading-none text-[#172117] sm:text-5xl">{value}</strong>
            <span className="text-xs font-bold text-[#899087]">{unit}</span>
          </div>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f2f3ee] text-[#526647] [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      </div>
      <div className="mt-7 flex items-center gap-2 text-xs font-semibold text-[#687166]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />{note}</div>
    </article>
  );
}

function SortHeader({ label, column, active, direction, onSort, align = "left" }: { label: string; column: NpsSortKey; active: NpsSortKey; direction: SortDirection; onSort: (key: NpsSortKey) => void; align?: "left" | "right" }) {
  const isActive = active === column;
  return (
    <th className={`px-6 py-4 text-[11px] font-bold text-[#4e584c] ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={() => onSort(column)} className={`inline-flex items-center gap-1.5 ${align === "right" ? "ml-auto" : ""}`}>
        <span className={isActive && direction === "asc" ? "text-[#526647]" : "text-[#939a91]"}>↑</span>
        <span>{label}</span>
        <span className={isActive && direction === "desc" ? "text-[#526647]" : "text-[#939a91]"}>↓</span>
      </button>
    </th>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-[#596158]"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
      <strong className="text-[#1f2d1f]">{value.toLocaleString("es-MX")}</strong>
    </div>
  );
}

function NpsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { total: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-[#dedbd1] bg-white px-4 py-3 shadow-xl">
      <p className="text-xs font-bold text-[#1f2d1f]">{label}</p>
      <p className="mt-1 text-sm text-[#526647]">NPS: <strong>{payload[0].value}</strong></p>
      <p className="text-xs text-[#7a8176]">Encuestas: {payload[0].payload.total.toLocaleString("es-MX")}</p>
    </div>
  );
}

function normalizeOptions(options: string[]): string[] {
  return Array.from(
    new Set(options.map((option) => option?.trim()).filter((option): option is string => Boolean(option))),
  ).sort((left, right) => left.localeCompare(right, "es-MX", { sensitivity: "base" }));
}

function rangeFromMonth(value: string): { start: string; end: string } | null {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function dateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthLabel(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : format(date, "dd MMM yyyy HH:mm");
}

function downloadCsv(filename: string, headers: Array<string | number>, rows: Array<Array<unknown>>) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
