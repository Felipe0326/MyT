"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { ChartVisibilityProvider } from "../SafeResponsiveContainer";
import { SmoothFilterSelect } from "../SmoothFilterSelect";
import {
  EMPTY_RECAUDACION_DASHBOARD,
  fetchRecaudacionDashboard,
  type RecaudacionDashboardData,
  type TramiteData,
} from "../refrendos/services/dataService";
import { formatCurrency } from "../refrendos/constants";
import { DailyEvolutionChart } from "../refrendos/components/dashboard/DailyEvolutionChart";
import { RevenueChart } from "../refrendos/components/dashboard/RevenueChart";
import { ToggleBtn } from "../refrendos/components/dashboard/ToggleBtn";

const MONTH_CONFIG = {
  jan: { id: 1, name: "Enero", short: "Ene" },
  feb: { id: 2, name: "Febrero", short: "Feb" },
  mar: { id: 3, name: "Marzo", short: "Mar" },
  abr: { id: 4, name: "Abril", short: "Abr" },
  may: { id: 5, name: "Mayo", short: "May" },
  jun: { id: 6, name: "Junio", short: "Jun" },
  jul: { id: 7, name: "Julio", short: "Jul" },
  aug: { id: 8, name: "Agosto", short: "Ago" },
  sep: { id: 9, name: "Septiembre", short: "Sep" },
  oct: { id: 10, name: "Octubre", short: "Oct" },
  nov: { id: 11, name: "Noviembre", short: "Nov" },
  dec: { id: 12, name: "Diciembre", short: "Dic" },
} as const;

type MonthKey = keyof typeof MONTH_CONFIG;
type LicenseYear = 2025 | 2026;
type Modalidad = "" | "en_linea" | "presencial";
type LicenciasSortKey = "date" | "tipo_tramite" | "tipo_licencia" | "presencial" | "en_linea" | "total";
type SortDirection = "asc" | "desc";

type LicenciaRecord = {
  id: number;
  fecha: string;
  anio: number;
  mes: string;
  dia_semana: string;
  tipo_tramite_id: number;
  tipo_tramite: string;
  tipo_licencia_id: number;
  tipo_licencia: string;
  tramites_presenciales: number;
  tramites_en_linea: number;
  total_tramites: number;
  actualizado_en: string;
};

type LicenciasResponse = {
  metrics: {
    tramites_presenciales: number;
    tramites_en_linea: number;
    total_tramites: number;
  };
  dailyTrend: LicenciaRecord[];
  records: LicenciaRecord[];
  filters: {
    tiposTramite: Array<{ id: number; nombre: string }>;
    tiposLicencia: Array<{ id: number; nombre: string }>;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
  actualizado_en: string | null;
};

const EMPTY_RESPONSE: LicenciasResponse = {
  metrics: { tramites_presenciales: 0, tramites_en_linea: 0, total_tramites: 0 },
  dailyTrend: [],
  records: [],
  filters: { tiposTramite: [], tiposLicencia: [] },
  pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0, hasPrevious: false, hasNext: false },
  actualizado_en: null,
};

const UPDATE_WEBHOOK =
  process.env.NEXT_PUBLIC_N8N_LICENCIAS_WEBHOOK_URL?.trim()
  || "https://lowcode.morelos.gob.mx/webhook/actualizar-licencias";

export function LicenciasDashboard({ isActive = true }: { isActive?: boolean }) {
  const [selectedYear, setSelectedYear] = useState<LicenseYear>(2026);
  const [currentMonth, setCurrentMonth] = useState<MonthKey>("aug");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [modalidad, setModalidad] = useState<Modalidad>("");
  const [tipoTramiteId, setTipoTramiteId] = useState("");
  const [tipoLicenciaId, setTipoLicenciaId] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<LicenciasSortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [dashboard, setDashboard] = useState<LicenciasResponse>(EMPTY_RESPONSE);
  const [recaudacion, setRecaudacion] = useState<RecaudacionDashboardData>(EMPTY_RECAUDACION_DASHBOARD);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRevenueLoading, setIsRevenueLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        month: String(MONTH_CONFIG[currentMonth].id),
        page: String(page),
        sort: sortKey,
        direction: sortDirection,
      });
      if (dateRange.start) params.set("dateFrom", dateRange.start);
      if (dateRange.end) params.set("dateTo", dateRange.end);
      if (modalidad) params.set("modalidad", modalidad);
      if (tipoTramiteId) params.set("tipoTramiteId", tipoTramiteId);
      if (tipoLicenciaId) params.set("tipoLicenciaId", tipoLicenciaId);

      const response = await fetch(`/api/licencias?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      const payload = await response.json() as LicenciasResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "No fue posible consultar Licencias.");
      setDashboard(payload);
      setError(null);
    } catch (requestError) {
      if ((requestError as Error).name !== "AbortError") setError((requestError as Error).message);
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [currentMonth, dateRange.end, dateRange.start, modalidad, page, selectedYear, sortDirection, sortKey, tipoLicenciaId, tipoTramiteId]);

  useEffect(() => {
    if (!isActive) return;
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData, isActive]);

  useEffect(() => {
    if (!isActive) return;
    const controller = new AbortController();
    setIsRevenueLoading(true);
    void fetchRecaudacionDashboard(controller.signal, "/api/licencias/recaudacion")
      .then((result) => {
        if (!controller.signal.aborted) {
          setRecaudacion(result);
          setRevenueError(null);
        }
      })
      .catch((requestError) => {
        if ((requestError as Error).name !== "AbortError") setRevenueError((requestError as Error).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsRevenueLoading(false);
      });
    return () => controller.abort();
  }, [isActive]);

  async function handleManualUpdate() {
    if (isUpdating) return;
    setIsUpdating(true);
    setError(null);
    try {
      const response = await fetch(UPDATE_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origen: "dashboard-licencias", solicitado_en: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(`n8n respondió ${response.status}.`);
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      await fetchData();
    } catch (updateError) {
      setError(`No fue posible actualizar Licencias: ${(updateError as Error).message}`);
    } finally {
      setIsUpdating(false);
    }
  }

  const chartData = useMemo<TramiteData[]>(() => dashboard.dailyTrend.map((row) => {
    const fullDate = new Date(`${row.fecha}T12:00:00`);
    return {
      date: `${String(fullDate.getDate()).padStart(2, "0")}/${String(fullDate.getMonth() + 1).padStart(2, "0")}`,
      fullDate,
      day: fullDate.getDate(),
      month: fullDate.getMonth() + 1,
      year: fullDate.getFullYear(),
      dayOfWeek: row.dia_semana,
      total: row.total_tramites,
      digital: modalidad === "presencial" ? 0 : row.tramites_en_linea,
      traditional: modalidad === "en_linea" ? 0 : row.tramites_presenciales,
    };
  }), [dashboard.dailyTrend, modalidad]);

  const maxProcedures = useMemo(() => {
    const totalsByDay = new Map<string, number>();
    chartData.forEach((row) => {
      totalsByDay.set(row.date, (totalsByDay.get(row.date) ?? 0) + row.total);
    });
    return Math.max(0, ...totalsByDay.values());
  }, [chartData]);

  const visibleMonths = useMemo(
    () => (Object.keys(MONTH_CONFIG) as MonthKey[]).filter(
      (month) => selectedYear === 2025 || MONTH_CONFIG[month].id <= 8,
    ),
    [selectedYear],
  );

  function changeYear(year: LicenseYear) {
    setSelectedYear(year);
    if (year === 2026 && MONTH_CONFIG[currentMonth].id > 8) {
      setCurrentMonth("aug");
    }
    setDateRange({ start: "", end: "" });
    setPage(1);
  }

  function changeMonth(month: MonthKey) {
    setCurrentMonth(month);
    setDateRange({ start: "", end: "" });
    setPage(1);
  }

  function changeModalidad(value: Modalidad) {
    setModalidad(value);
    setPage(1);
  }

  function changeTipoTramite(value: string) {
    setTipoTramiteId(value);
    setPage(1);
  }

  function changeTipoLicencia(value: string) {
    setTipoLicenciaId(value);
    setPage(1);
  }

  function selectDate(date: Date) {
    const value = toDateInput(date);
    const month = monthKeyFromNumber(date.getMonth() + 1);
    if (month) setCurrentMonth(month);
    setDateRange({ start: value, end: value });
    setPage(1);
  }

  function selectMonthFromRevenue(monthName: string) {
    const normalized = monthName.trim().slice(0, 3).toLocaleLowerCase("es-MX");
    const month = (Object.entries(MONTH_CONFIG) as Array<[MonthKey, (typeof MONTH_CONFIG)[MonthKey]]>)
      .find(([, value]) => value.short.toLocaleLowerCase("es-MX") === normalized)?.[0];
    if (month && visibleMonths.includes(month)) changeMonth(month);
  }

  function toggleSort(key: LicenciasSortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((current) => current === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection(key === "date" ? "desc" : "asc");
    }
  }

  function clearFilters() {
    setDateRange({ start: "", end: "" });
    setModalidad("");
    setTipoTramiteId("");
    setTipoLicenciaId("");
    setPage(1);
  }

  function exportRecords() {
    setIsExporting(true);
    try {
      const headers = ["ID", "Fecha", "Año", "Mes", "Día de la semana", "Tipo de trámite", "Tipo de licencia", "Presenciales", "En línea", "Total", "Actualizado en"];
      const rows = dashboard.dailyTrend.map((row) => [
        row.id,
        row.fecha,
        row.anio,
        row.mes,
        row.dia_semana,
        row.tipo_tramite,
        row.tipo_licencia,
        row.tramites_presenciales,
        row.tramites_en_linea,
        row.total_tramites,
        row.actualizado_en,
      ]);
      downloadCsv(`licencias_${MONTH_CONFIG[currentMonth].name.toLowerCase()}_${selectedYear}.csv`, headers, rows);
    } finally {
      setIsExporting(false);
    }
  }

  const total = dashboard.metrics.total_tramites;
  const percentage = (value: number) => total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";
  const modeLabel = modalidad === "en_linea" ? "En línea" : modalidad === "presencial" ? "Presencial" : "Todas las modalidades";

  return (
    <ChartVisibilityProvider active={isActive}>
      <div className="min-h-screen bg-[#F5F4F0] pb-12 font-sans text-[#2E332A]">
        <header className="relative bg-[#F5F4F0] px-3 py-4 text-[#2E332A] sm:px-5 lg:px-6">
          <div className="relative w-full rounded-[26px] border border-[#dedccf] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(46,51,42,0.07)] sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#d8d3c7] bg-[#ebe7dd] shadow-sm">
                  <FileText className="h-7 w-7 text-[#7B543E]" />
                  {isLoading && <Loader2 className="absolute -right-1 -top-1 h-4 w-4 animate-spin text-[#74785C]" />}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#7B543E]">Movilidad y Transporte</p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Licencias {selectedYear}</h1>
                  <p className="mt-1 text-sm text-[#747169]">Actividad diaria · {MONTH_CONFIG[currentMonth].name}</p>
                </div>
              </div>

              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                <div className="inline-flex w-fit shrink-0 items-center rounded-2xl border border-[#d8d3c7] bg-white p-1.5 shadow-sm" aria-label="Seleccionar año">
                  {([2025, 2026] as const).map((year) => (
                    <button
                      key={year}
                      type="button"
                      onClick={() => changeYear(year)}
                      aria-pressed={selectedYear === year}
                      className={`min-h-9 rounded-xl px-3 text-xs font-black transition ${
                        selectedYear === year
                          ? "bg-[#74785C] text-white shadow-sm"
                          : "text-[#526647] hover:bg-[#F5F4F0]"
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>

                <div className="scrollbar-hide min-w-0 overflow-x-auto pb-1 sm:pb-0">
                  <div className="inline-flex min-w-max items-center rounded-2xl border border-[#d8d3c7] bg-[#e9e6dd] p-1.5">
                    {visibleMonths.map((month) => (
                      <ToggleBtn
                        key={month}
                        active={currentMonth === month}
                        onClick={() => changeMonth(month)}
                        label={MONTH_CONFIG[month].short}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleManualUpdate()}
                  disabled={isUpdating || isLoading}
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#d8d3c7] bg-white px-5 py-2.5 text-xs font-bold text-[#526647] shadow-sm transition hover:bg-[#ebe7dd] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Actualizar
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-[1600px] space-y-7 px-3 sm:px-5 lg:px-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm">{error}</div>
          )}

          <section className="rounded-[26px] border border-[#dedccf] bg-white p-4 shadow-[0_12px_35px_rgba(46,51,42,0.08)] sm:p-6">
            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#74785C]">Explorar registros</p>
                <h2 className="mt-1 text-lg font-bold text-[#2E332A]">Filtros de Licencias</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">Vista actual: {modeLabel}</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(155px,0.8fr)_minmax(155px,0.8fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(190px,1fr)_auto] xl:items-end">
              <DateField label="Fecha inicial" year={selectedYear} value={dateRange.start} onChange={(value) => { setDateRange((current) => ({ ...current, start: value })); setPage(1); }} />
              <DateField label="Fecha final" year={selectedYear} value={dateRange.end} onChange={(value) => { setDateRange((current) => ({ ...current, end: value })); setPage(1); }} />
              <SelectField label="Tipo de trámite" value={tipoTramiteId} onChange={changeTipoTramite} options={dashboard.filters.tiposTramite} placeholder="Todos los trámites" />
              <SelectField label="Tipo de licencia" value={tipoLicenciaId} onChange={changeTipoLicencia} options={dashboard.filters.tiposLicencia} placeholder="Todas las licencias" />
              <ModeFilter value={modalidad} onChange={changeModalidad} />
              <button type="button" onClick={clearFilters} className="h-12 rounded-xl border border-[#dedccf] bg-[#F5F4F0] px-5 text-xs font-black uppercase tracking-[0.12em] text-[#526647] transition hover:bg-[#ebe7dd]">
                Limpiar
              </button>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <LicenseMetricCard title="Total filtrado" value={total} detail={modeLabel} icon={Activity} accent="bg-[#74785C]" />
            <LicenseMetricCard title="Trámites en línea" value={dashboard.metrics.tramites_en_linea} detail={percentage(dashboard.metrics.tramites_en_linea)} icon={Smartphone} accent="bg-[#526647]" />
            <LicenseMetricCard title="Trámites presenciales" value={dashboard.metrics.tramites_presenciales} detail={percentage(dashboard.metrics.tramites_presenciales)} icon={Building2} accent="bg-[#8A495D]" />
          </section>

          <DailyEvolutionChart
            data={chartData}
            maxProcedures={maxProcedures}
            formatCurrency={(value) => value.toLocaleString("es-MX")}
            CustomLegend={(value) => value}
            CustomizedDot={() => null}
            onFilterDate={selectDate}
            description="Comparativo diario de trámites en línea y presenciales. Selecciona un día para filtrar."
          />

          <LicenciasRecordsTable
            records={dashboard.records}
            pagination={dashboard.pagination}
            modalidad={modalidad}
            sortKey={sortKey}
            sortDirection={sortDirection}
            exporting={isExporting}
            onSort={toggleSort}
            onPageChange={setPage}
            onExport={exportRecords}
            onSelect={(record) => selectDate(new Date(`${record.fecha}T12:00:00`))}
          />

          <RevenueChart
            refrendoData={recaudacion.refrendo}
            licenciasData={recaudacion.licencias}
            formatCurrency={formatCurrency}
            onMonthSelect={selectMonthFromRevenue}
            loading={isRevenueLoading}
            error={revenueError}
            onlyLicencias
          />

          <p className="pb-2 text-center text-[10px] italic text-slate-400 sm:text-xs">La recaudación corresponde únicamente a Licencias.</p>
        </main>
      </div>
    </ChartVisibilityProvider>
  );
}

function DateField({ label, year, value, onChange }: { label: string; year: LicenseYear; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#74785C]">
        <CalendarDays className="h-3.5 w-3.5" /> {label}
      </span>
      <input type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-[#dedccf] bg-[#faf9f5] px-4 text-sm text-[#2E332A] outline-none focus:border-[#74785C] focus:ring-4 focus:ring-[#74785C]/10" />
    </label>
  );
}

function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: number; nombre: string }>; placeholder: string }) {
  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-black uppercase tracking-widest text-[#74785C]">{label}</span>
      <SmoothFilterSelect
        value={value}
        onChange={onChange}
        options={options.map((option) => ({ value: String(option.id), label: option.nombre }))}
        placeholder={placeholder}
        ariaLabel={label}
        searchPlaceholder={`Buscar ${label.toLocaleLowerCase("es-MX")}...`}
        searchable
      />
    </div>
  );
}

function ModeFilter({ value, onChange }: { value: Modalidad; onChange: (value: Modalidad) => void }) {
  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-black uppercase tracking-widest text-[#74785C]">Modalidad del trámite</span>
      <SmoothFilterSelect
        value={value}
        onChange={(nextValue) => onChange(nextValue as Modalidad)}
        options={[
          { value: "en_linea", label: "En línea" },
          { value: "presencial", label: "Presencial" },
        ]}
        placeholder="Todas las modalidades"
        ariaLabel="Modalidad del trámite"
      />
    </div>
  );
}

function LicenseMetricCard({ title, value, detail, icon: Icon, accent }: { title: string; value: number; detail: string; icon: LucideIcon; accent: string }) {
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-[#dedccf] bg-white p-5 shadow-[0_10px_28px_rgba(46,51,42,0.07)] sm:p-6">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
          <strong className="mt-3 block text-3xl font-bold tracking-tight text-[#2E332A]">{value.toLocaleString("es-MX")}</strong>
          <span className="mt-2 block text-xs font-semibold text-[#74785C]">{detail}</span>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent} text-white shadow-sm`}><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

function LicenciasRecordsTable({ records, pagination, modalidad, sortKey, sortDirection, exporting, onSort, onPageChange, onExport, onSelect }: {
  records: LicenciaRecord[];
  pagination: LicenciasResponse["pagination"];
  modalidad: Modalidad;
  sortKey: LicenciasSortKey;
  sortDirection: SortDirection;
  exporting: boolean;
  onSort: (key: LicenciasSortKey) => void;
  onPageChange: (page: number) => void;
  onExport: () => void;
  onSelect: (record: LicenciaRecord) => void;
}) {
  const [visible, setVisible] = useState(true);
  const showOnline = modalidad !== "presencial";
  const showPresencial = modalidad !== "en_linea";
  const columnCount = 5 + Number(showOnline) + Number(showPresencial);

  return (
    <section className="min-w-0 overflow-hidden rounded-[26px] border border-[#dedccf] bg-white shadow-[0_10px_30px_rgba(46,51,42,0.07)]">
      <div className="flex flex-col gap-4 border-b border-[#e8e5dc] px-4 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#74785C]">Detalle operativo</p>
          <h3 className="mt-1 text-lg font-bold text-[#2E332A]">Registros diarios de Licencias</h3>
          <p className="mt-1 text-xs text-slate-500">50 registros por página · {pagination.total.toLocaleString("es-MX")} resultados</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setVisible((current) => !current)} aria-expanded={visible} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dedccf] bg-white px-4 text-xs font-bold text-[#526647] hover:bg-[#F5F4F0]">
            {visible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {visible ? "Ocultar tabla" : "Mostrar tabla"}
          </button>
          <button type="button" onClick={onExport} disabled={exporting || pagination.total === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#74785C] px-4 text-xs font-bold text-white hover:bg-[#62664d] disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar filtrados
          </button>
        </div>
      </div>

      {visible && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead className="bg-[#74785C] text-white">
                <tr>
                  <SortHeader label="Fecha" column="date" active={sortKey} direction={sortDirection} onSort={onSort} />
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/75">Día</th>
                  <SortHeader label="Tipo de trámite" column="tipo_tramite" active={sortKey} direction={sortDirection} onSort={onSort} />
                  <SortHeader label="Tipo de licencia" column="tipo_licencia" active={sortKey} direction={sortDirection} onSort={onSort} />
                  {showPresencial && <SortHeader label="Presenciales" column="presencial" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />}
                  {showOnline && <SortHeader label="En línea" column="en_linea" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />}
                  <SortHeader label="Total" column="total" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f5]">
                {records.map((record) => (
                  <tr key={record.id} onClick={() => onSelect(record)} className="cursor-pointer transition hover:bg-[#F5F4F0]">
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#2E332A]">{formatDate(record.fecha)}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{record.dia_semana}</td>
                    <td className="max-w-[260px] px-5 py-4 text-sm text-[#2E332A]"><span className="block truncate" title={record.tipo_tramite}>{record.tipo_tramite}</span></td>
                    <td className="max-w-[260px] px-5 py-4 text-sm text-[#2E332A]"><span className="block truncate" title={record.tipo_licencia}>{record.tipo_licencia}</span></td>
                    {showPresencial && <td className="px-5 py-4 text-right text-sm font-semibold text-[#765c47]">{record.tramites_presenciales.toLocaleString("es-MX")}</td>}
                    {showOnline && <td className="px-5 py-4 text-right text-sm font-semibold text-[#526647]">{record.tramites_en_linea.toLocaleString("es-MX")}</td>}
                    <td className="px-5 py-4 text-right text-sm font-bold text-[#2E332A]">{record.total_tramites.toLocaleString("es-MX")}</td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-slate-500">No hay registros para los filtros seleccionados.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#e8e5dc] bg-[#faf9f5] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span className="text-xs font-semibold text-slate-500">Página {pagination.page} de {Math.max(1, pagination.totalPages)}</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!pagination.hasPrevious} onClick={() => onPageChange(Math.max(1, pagination.page - 1))} className="min-h-11 rounded-xl border border-[#dedccf] bg-white px-5 text-xs font-bold text-[#526647] disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
              <button type="button" disabled={!pagination.hasNext} onClick={() => onPageChange(pagination.page + 1)} className="min-h-11 rounded-xl bg-[#74785C] px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SortHeader({ label, column, active, direction, onSort, align = "left" }: { label: string; column: LicenciasSortKey; active: LicenciasSortKey; direction: SortDirection; onSort: (key: LicenciasSortKey) => void; align?: "left" | "right" }) {
  const selected = active === column;
  return (
    <th className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={() => onSort(column)} className={`inline-flex min-h-10 items-center gap-1.5 ${align === "right" ? "ml-auto" : ""}`}>
        <span className={selected && direction === "asc" ? "text-[#f0ddad]" : "text-white/35"}>↑</span>
        <span>{label}</span>
        <span className={selected && direction === "desc" ? "text-[#f0ddad]" : "text-white/35"}>↓</span>
      </button>
    </th>
  );
}

function monthKeyFromNumber(month: number): MonthKey | null {
  return (Object.entries(MONTH_CONFIG) as Array<[MonthKey, (typeof MONTH_CONFIG)[MonthKey]]>)
    .find(([, value]) => value.id === month)?.[0] ?? null;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
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
