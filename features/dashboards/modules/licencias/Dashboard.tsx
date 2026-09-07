"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Building2,
  FileText,
  Loader2,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { ChartVisibilityProvider } from "@/components/ui/SafeResponsiveContainer";
import {
  DashboardUpdateNotice,
  type DashboardUpdateNoticeValue,
} from "@/features/dashboards/shared/components/DashboardUpdateNotice";
import { downloadCsv } from "@/features/dashboards/shared/lib/csv";
import {
  EMPTY_RECAUDACION_DASHBOARD,
  fetchRecaudacionDashboard,
  type RecaudacionDashboardData,
} from "@/features/dashboards/shared/services/revenueService";
import type { DailyChartPoint } from "@/features/dashboards/shared/types";
import { formatCurrency } from "@/features/dashboards/shared/constants";
import { DailyEvolutionChart } from "@/features/dashboards/shared/components/DailyEvolutionChart";
import { RevenueChart } from "@/features/dashboards/shared/components/RevenueChart";
import { ToggleBtn } from "@/features/dashboards/shared/components/ToggleBtn";
import {
  DateField,
  LicenseMetricCard,
  LicenciasRecordsTable,
  ModeFilter,
  SelectField,
} from "@/features/dashboards/modules/licencias/components/LicenciasDashboardParts";
import type {
  LicenciasResponse,
  LicenciasSortKey,
  LicenseYear,
  Modalidad,
  MonthKey,
  SortDirection,
} from "@/features/dashboards/modules/licencias/types";

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

type SelectedMonth = MonthKey | "all";

const EMPTY_RESPONSE: LicenciasResponse = {
  metrics: { tramites_presenciales: 0, tramites_en_linea: 0, total_tramites: 0 },
  dailyTrend: [],
  records: [],
  filters: { tiposTramite: [], tiposLicencia: [] },
  pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0, hasPrevious: false, hasNext: false },
  actualizado_en: null,
};

function visibleMonthCount(year: number, today = new Date()) {
  if (today.getFullYear() < year) return 0;
  if (today.getFullYear() > year) return 12;
  return today.getMonth() + 1;
}

export function LicenciasDashboard({
  isActive = true,
  csrfToken,
  canUpdate = false,
}: {
  isActive?: boolean;
  csrfToken: string;
  canUpdate?: boolean;
}) {
  const [selectedYear, setSelectedYear] = useState<LicenseYear>(2026);
  const [currentMonth, setCurrentMonth] = useState<SelectedMonth>("all");
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
  const [updateNotice, setUpdateNotice] = useState<DashboardUpdateNoticeValue | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        page: String(page),
        sort: sortKey,
        direction: sortDirection,
      });
      if (currentMonth !== "all") params.set("month", String(MONTH_CONFIG[currentMonth].id));
      if (dateRange.start) params.set("dateFrom", dateRange.start);
      if (dateRange.end) params.set("dateTo", dateRange.end);
      if (modalidad) params.set("modalidad", modalidad);
      if (tipoTramiteId) params.set("tipoTramiteId", tipoTramiteId);
      if (tipoLicenciaId) params.set("tipoLicenciaId", tipoLicenciaId);

      const response = await fetch(`/api/dashboards/dashboard-licencias?${params.toString()}`, {
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
    void fetchRecaudacionDashboard(controller.signal, "/api/dashboards/dashboard-licencias/datasets/recaudacion")
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
    if (isUpdating || !canUpdate) return;
    setIsUpdating(true);
    setUpdateNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/dashboards/dashboard-licencias/refresh", {
        method: "POST",
        headers: { "x-csrf-token": csrfToken },
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        throw new Error(payload.error || "No fue posible solicitar la actualización.");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      await fetchData();
      setUpdateNotice({
        type: "success",
        message: "Licencias actualizadas correctamente.",
      });
    } catch {
      setUpdateNotice({
        type: "error",
        message: "No fue posible actualizar Licencias.",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  const chartData = useMemo<DailyChartPoint[]>(() => dashboard.dailyTrend.map((row) => {
    const fullDate = new Date(`${row.fecha}T12:00:00`);
    return {
      date: `${String(fullDate.getDate()).padStart(2, "0")}/${String(fullDate.getMonth() + 1).padStart(2, "0")}`,
      fullDate,
      day: fullDate.getDate(),
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
    () => (Object.keys(MONTH_CONFIG) as MonthKey[]).slice(0, visibleMonthCount(selectedYear)),
    [selectedYear],
  );

  function changeYear(year: LicenseYear) {
    setSelectedYear(year);
    const lastVisibleMonth = (Object.keys(MONTH_CONFIG) as MonthKey[])[visibleMonthCount(year) - 1];
    if (currentMonth !== "all" && MONTH_CONFIG[currentMonth].id > visibleMonthCount(year)) {
      setCurrentMonth(lastVisibleMonth ?? "all");
    }
    setDateRange({ start: "", end: "" });
    setPage(1);
  }

  function changeMonth(month: SelectedMonth) {
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
    setCurrentMonth("all");
    setDateRange({ start: "", end: "" });
    setModalidad("");
    setTipoTramiteId("");
    setTipoLicenciaId("");
    setPage(1);
  }

  async function exportRecords() {
    setIsExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: String(selectedYear),
        sort: sortKey,
        direction: sortDirection,
      });
      if (currentMonth !== "all") params.set("month", String(MONTH_CONFIG[currentMonth].id));
      if (dateRange.start) params.set("dateFrom", dateRange.start);
      if (dateRange.end) params.set("dateTo", dateRange.end);
      if (modalidad) params.set("modalidad", modalidad);
      if (tipoTramiteId) params.set("tipoTramiteId", tipoTramiteId);
      if (tipoLicenciaId) params.set("tipoLicenciaId", tipoLicenciaId);

      const response = await fetch(`/api/dashboards/dashboard-licencias/export?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json() as LicenciasResponse["records"] | { error?: string };
      if (!response.ok) {
        const message = !Array.isArray(payload) ? payload.error : undefined;
        throw new Error(message || "No fue posible exportar Licencias.");
      }

      const headers = ["ID", "Fecha", "Año", "Mes", "Día de la semana", "Tipo de trámite", "Tipo de licencia", "Presenciales", "En línea", "Total", "Actualizado en"];
      const rows = (payload as LicenciasResponse["records"]).map((row) => [
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
      const period = currentMonth === "all" ? "todos" : MONTH_CONFIG[currentMonth].name.toLowerCase();
      downloadCsv(`licencias_${period}_${selectedYear}.csv`, headers, rows);
    } catch (exportError) {
      setError((exportError as Error).message);
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
                  <p className="mt-1 text-sm text-[#747169]">Actividad diaria · {currentMonth === "all" ? "Todos los meses" : MONTH_CONFIG[currentMonth].name}</p>
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
                      className={`min-h-9 min-w-[68px] rounded-xl px-3 text-center text-xs font-black transition ${
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
                    <ToggleBtn
                      active={currentMonth === "all"}
                      onClick={() => changeMonth("all")}
                      label="Todos"
                    />
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

                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => void handleManualUpdate()}
                    disabled={isUpdating || isLoading}
                    className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-[#d8d3c7] bg-white px-5 py-2.5 text-xs font-bold text-[#526647] shadow-sm transition hover:bg-[#ebe7dd] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Actualizar
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="relative z-10 mx-auto w-full max-w-[1600px] space-y-7 px-3 sm:px-5 lg:px-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 shadow-sm">{error}</div>
          )}
          <DashboardUpdateNotice
            notice={updateNotice}
            onDismiss={() => setUpdateNotice(null)}
          />

          <section className="rounded-[26px] border border-[#dedccf] bg-white p-4 shadow-[0_12px_35px_rgba(46,51,42,0.08)] sm:p-6">
            <div className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#74785C]">Explorar registros</p>
                <h2 className="mt-1 text-lg font-bold text-[#2E332A]">Filtros de Licencias</h2>
              </div>
              <span className="text-xs font-semibold text-slate-400">Vista actual: {modeLabel}</span>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(175px,0.9fr)_minmax(175px,0.9fr)_minmax(190px,1fr)_minmax(190px,1fr)_minmax(190px,1fr)_auto] xl:items-end">
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

function monthKeyFromNumber(month: number): MonthKey | null {
  return (Object.entries(MONTH_CONFIG) as Array<[MonthKey, (typeof MONTH_CONFIG)[MonthKey]]>)
    .find(([, value]) => value.id === month)?.[0] ?? null;
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
