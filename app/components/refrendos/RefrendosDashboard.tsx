"use client";

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Activity, Smartphone, Building2, Loader2, RefreshCw, Car, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from '../MotionShim';
import { SmoothFilterSelect } from '../SmoothFilterSelect';

import {
  getAggregatedStats,
  getMonthlyComparativeData,
  getGestoresData,
  getFebruaryRevenueData,
  getJanuaryRevenueData,
  getMarchRevenueData,
  getAprilRevenueData,
  getMayRevenueData,
  getJuneRevenueData,
  getJulyRevenueData,
  fetchRefrendoDashboard,
  EMPTY_REFRENDO_DASHBOARD,
  type RefrendoDashboardResponse,
  type RefrendoRecord,
  type RefrendoSortKey,
  type SortDirection,
  type TramiteData,
} from './services/dataService';
import { formatCurrency } from './constants';

import { StatCard } from './components/dashboard/StatCard';
import { ToggleBtn } from './components/dashboard/ToggleBtn';
import { DailyEvolutionChart } from './components/dashboard/DailyEvolutionChart';
import { RevenueChart } from './components/dashboard/RevenueChart';
import { GestoresChart } from './components/dashboard/GestoresChart';
import { DailyRevenueChart } from './components/dashboard/DailyRevenueChart';
import { RefrendoRecordsTable } from './components/dashboard/RefrendoRecordsTable';
import { AnalysisTab } from './components/dashboard/AnalysisTab';

const MONTH_CONFIG = {
  jan: { id: 1, name: 'Enero', short: 'Ene' },
  feb: { id: 2, name: 'Febrero', short: 'Feb' },
  mar: { id: 3, name: 'Marzo', short: 'Mar' },
  abr: { id: 4, name: 'Abril', short: 'Abr' },
  may: { id: 5, name: 'Mayo', short: 'May' },
  jun: { id: 6, name: 'Junio', short: 'Jun' },
  jul: { id: 7, name: 'Julio', short: 'Jul' },
} as const;

type MonthKey = keyof typeof MONTH_CONFIG;

export const RefrendosDashboard = () => {
  const [currentMonth, setCurrentMonth] = useState<MonthKey>('jul');
  const [showExtraCharts, setShowExtraCharts] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis'>('dashboard');

  const [dashboard, setDashboard] = useState<RefrendoDashboardResponse>(EMPTY_REFRENDO_DASHBOARD);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [movement, setMovement] = useState('');
  const [hour, setHour] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<RefrendoSortKey>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    setIsSyncing(true);
    try {
      const result = await fetchRefrendoDashboard({
        year: 2026,
        month: MONTH_CONFIG[currentMonth].id,
        dateFrom: dateRange.start || undefined,
        dateTo: dateRange.end || undefined,
        movimiento: movement || undefined,
        hora: hour === '' ? undefined : Number(hour),
        page,
        pageSize: 50,
        sort: sortKey,
        direction: sortDirection,
      }, signal);
      if (!signal?.aborted) {
        setDashboard(result);
        setError(null);
      }
    } catch (requestError) {
      if ((requestError as Error).name !== 'AbortError') {
        setError((requestError as Error).message);
      }
    } finally {
      if (!signal?.aborted) setIsSyncing(false);
    }
  }, [currentMonth, dateRange.start, dateRange.end, movement, hour, page, sortKey, sortDirection]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchData(controller.signal);
    return () => controller.abort();
  }, [fetchData]);

  const handleManualUpdate = async () => {
    if (isUpdating) return;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      setIsUpdating(true);
      await fetch('https://lowcode.morelos.gob.mx/webhook/refrendo_dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    } catch (updateError) {
      console.error('No fue posible ejecutar la actualización manual:', updateError);
    } finally {
      clearTimeout(timeoutId);
      await fetchData();
      setIsUpdating(false);
    }
  };

  const rawData = useMemo<TramiteData[]>(() => dashboard.dailyTrend.map((item) => {
    const fullDate = new Date(`${item.fecha}T12:00:00`);
    return {
      date: `${String(fullDate.getDate()).padStart(2, '0')}/${String(fullDate.getMonth() + 1).padStart(2, '0')}`,
      fullDate,
      day: fullDate.getDate(),
      month: fullDate.getMonth() + 1,
      year: fullDate.getFullYear(),
      dayOfWeek: '',
      total: Number(item.totalRegistros) || 0,
      digital: Number(item.digital) || 0,
      traditional: Number(item.tradicional) || 0,
      total2024: 0,
      total2025: 0,
    };
  }), [dashboard.dailyTrend]);

  const monthlyRevenueData = useMemo(() => getMonthlyComparativeData(), []);
  const gestoresData = useMemo(() => getGestoresData(), []);

  const allMonthlyRevenue = useMemo(() => ({
    jan: getJanuaryRevenueData(),
    feb: getFebruaryRevenueData(),
    mar: getMarchRevenueData(),
    abr: getAprilRevenueData(),
    may: getMayRevenueData(),
    jun: getJuneRevenueData(),
    jul: getJulyRevenueData(),
  }), []);

  const revenueData = useMemo(() => allMonthlyRevenue[currentMonth], [currentMonth, allMonthlyRevenue]);
  const accumulatedRevenue = useMemo(() => {
    const months: MonthKey[] = ['jan', 'feb', 'mar', 'abr', 'may', 'jun', 'jul'];
    const currentIndex = months.indexOf(currentMonth);
    return months.slice(0, currentIndex + 1).reduce((total, month) => (
      total + allMonthlyRevenue[month].reduce((sum, item) => sum + item.publico + item.privado, 0)
    ), 0);
  }, [currentMonth, allMonthlyRevenue]);

  const filteredData = rawData;
  const maxProcedures = useMemo(() => Math.max(...rawData.map((item) => item.total), 0), [rawData]);
  const stats = useMemo(() => getAggregatedStats(filteredData), [filteredData]);
  const accumulatedMonthlyTotal = dashboard.metrics.total_registros;
  const totalGestores = useMemo(() => gestoresData.reduce((sum, item) => sum + item.gestores, 0), [gestoresData]);

  const CustomLegend = useCallback((value: string) => (
    <span className="ml-1 text-xs font-bold uppercase tracking-wide text-slate-600">{value}</span>
  ), []);

  const CustomizedDot = useCallback((props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    const isGreen = (payload.total2025 ? payload.total > payload.total2025 : true)
      && (payload.total2024 ? payload.total > payload.total2024 : true)
      && (payload.total2025 || payload.total2024);
    return isGreen ? <circle cx={cx} cy={cy} r={4} stroke="#fff" strokeWidth={2} fill="#16a34a" /> : null;
  }, []);

  function changeMonth(month: MonthKey) {
    setCurrentMonth(month);
    setDateRange({ start: '', end: '' });
    setMovement('');
    setHour('');
    setPage(1);
  }

  function toggleSort(key: RefrendoSortKey) {
    setPage(1);
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'date' ? 'desc' : 'asc');
  }

  function clearFilters() {
    setDateRange({ start: '', end: '' });
    setMovement('');
    setHour('');
    setPage(1);
  }

  function selectDate(date: Date) {
    const value = toDateInput(date);
    const monthKey = monthKeyFromNumber(date.getMonth() + 1);
    if (monthKey) setCurrentMonth(monthKey);
    setDateRange({ start: value, end: value });
    setPage(1);
  }

  function selectRevenueDate(value: string) {
    const [day, month, year] = value.split('/').map(Number);
    if (!day || !month || !year) return;
    selectDate(new Date(year, month - 1, day, 12));
  }

  function selectMonthFromChart(monthName: string) {
    const key = monthKeyFromLabel(monthName);
    if (key) changeMonth(key);
  }

  function selectRecord(record: RefrendoRecord) {
    const monthKey = monthKeyFromNumber(Number(record.mes));
    if (monthKey) setCurrentMonth(monthKey);
    setDateRange({ start: record.fecha, end: record.fecha });
    setMovement(record.movimiento || '');
    setHour(record.hora == null ? '' : String(record.hora));
    setPage(1);
  }

  async function exportFilteredRecords() {
    setIsExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        year: '2026',
        month: String(MONTH_CONFIG[currentMonth].id),
        sort: sortKey,
        direction: sortDirection,
      });
      if (dateRange.start) params.set('dateFrom', dateRange.start);
      if (dateRange.end) params.set('dateTo', dateRange.end);
      if (movement) params.set('movimiento', movement);
      if (hour !== '') params.set('hora', hour);

      const response = await fetch(`/api/refrendos/export?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible exportar Refrendos.');

      const headers = ['ID', 'Fecha', 'Año', 'Mes', 'Día', 'Día de la semana', 'Movimiento', 'Hora', 'Total', 'Digital', 'Tradicional', '% digital', '% tradicional'];
      const rows = (payload as RefrendoDashboardResponse['records']).map((record) => [
        record.id,
        record.fecha,
        record.anio,
        record.mes,
        record.dia,
        record.dia_semana,
        record.movimiento,
        record.hora,
        record.total_registros,
        record.es_digital,
        record.es_tradicional,
        record.porcentaje_digital,
        record.porcentaje_tradicional,
      ]);
      downloadCsv(`refrendos_filtrados_${MONTH_CONFIG[currentMonth].name.toLowerCase()}_2026.csv`, headers, rows);
    } catch (exportError) {
      setError((exportError as Error).message);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] pb-12 font-sans text-brand-dark">
      {/* Header */}
      <header className="dashboard-sticky-header sticky border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="flex w-full flex-col gap-3 px-3 py-3 sm:px-5 lg:px-6 xl:flex-row xl:items-center xl:justify-between">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex min-w-0 items-center gap-3 sm:gap-4"
          >
            <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-dark shadow-lg shadow-brand-dark/20">
              <Car className="h-6 w-6 text-brand-secondary" />
              {isSyncing && (
                <div className="absolute -top-1 -right-1">
                   <Loader2 className="h-4 w-4 text-brand-primary animate-spin" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="text-balance text-base font-bold leading-tight tracking-tight text-brand-dark sm:text-xl">Tablero Movilidad y Transporte Recaudación 2026</h1>
              <div className="flex flex-col">
                <p className="text-[10px] sm:text-xs text-brand-primary font-semibold tracking-wide uppercase mt-1">
                  Gestión de Trámites {MONTH_CONFIG[currentMonth].name} 2026
                </p>
              </div>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="scrollbar-hide flex w-full items-center gap-2 overflow-x-auto pb-1 xl:w-auto xl:justify-end xl:pb-0"
          >
            <button
              id="btn-force-update"
              onClick={handleManualUpdate}
              disabled={isUpdating || isSyncing}
              aria-label="Actualizar información de refrendos"
              title="Actualizar información"
              className={`
                flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 py-2 transition-all
                ${isUpdating || isSyncing 
                  ? 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed' 
                  : 'bg-white text-brand-dark border-slate-200 hover:border-brand-primary hover:text-brand-primary active:scale-95 shadow-sm'}
              `}
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              )}
              <span className="hidden text-xs font-bold sm:inline">Actualizar</span>
            </button>

            <div className="flex shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-1">
              {(Object.keys(MONTH_CONFIG) as MonthKey[]).map((m) => (
                <ToggleBtn 
                  key={m}
                  active={currentMonth === m} 
                  onClick={() => changeMonth(m)}
                  label={MONTH_CONFIG[m].short}
                />
              ))}
            </div>
          </motion.div>
        </div>
        
        {/* Navigation Tabs */}
        <div className="scrollbar-hide mt-1 flex overflow-x-auto border-t border-slate-200 px-3 sm:px-5 lg:px-6">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`min-h-11 shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'dashboard' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('analysis')}
            className={`min-h-11 shrink-0 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'analysis' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Diagnóstico Ejecutivo
          </button>
        </div>
      </header>

      {activeTab === 'analysis' ? (
        <AnalysisTab />
      ) : (
      <main className="w-full space-y-6 px-3 py-5 sm:space-y-8 sm:px-5 sm:py-7 lg:px-6 lg:py-8">
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700">
            {error}
          </div>
        )}

        <section className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          {isSyncing && (
            <div className="mb-4 flex justify-end">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#eef1ea] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#526647]">
                <Loader2 className="h-3 w-3 animate-spin" /> Actualizando
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-[1.25fr_1.25fr_1fr_1fr_auto]">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                <CalendarDays className="h-3.5 w-3.5 text-[#526647]" /> Fecha inicial
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(event) => { setDateRange((current) => ({ ...current, start: event.target.value })); setPage(1); }}
                className="w-full rounded-xl border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm outline-none focus:border-[#526647] focus:ring-4 focus:ring-[#526647]/10"
              />
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                <CalendarDays className="h-3.5 w-3.5 text-[#526647]" /> Fecha final
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(event) => { setDateRange((current) => ({ ...current, end: event.target.value })); setPage(1); }}
                className="w-full rounded-xl border border-slate-200 bg-[#fbfaf7] px-4 py-3 text-sm outline-none focus:border-[#526647] focus:ring-4 focus:ring-[#526647]/10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600">Movimiento</label>
              <SmoothFilterSelect
                value={movement}
                onChange={(value) => { setMovement(value); setPage(1); }}
                options={dashboard.movimientos.map((option) => ({ value: option, label: option }))}
                placeholder="Todos los movimientos"
                ariaLabel="Movimiento"
                searchable
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600">Hora</label>
              <SmoothFilterSelect
                value={hour}
                onChange={(value) => { setHour(value); setPage(1); }}
                options={Array.from({ length: 24 }, (_, index) => ({
                  value: String(index),
                  label: `${String(index).padStart(2, '0')}:00`,
                }))}
                placeholder="Todas las horas"
                ariaLabel="Hora"
                align="end"
              />
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="h-[46px] w-full self-end rounded-full border border-slate-200 bg-slate-50 px-5 text-xs font-black uppercase tracking-wider text-[#526647] hover:bg-slate-100 sm:w-auto xl:w-full"
            >
              Limpiar
            </button>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          <StatCard 
            title="Total de Trámites" 
            value={stats.totalRegistros.toLocaleString()} 
            subValue={`Acumulado mes: ${accumulatedMonthlyTotal.toLocaleString()}`}
            icon={Activity} 
            trend={currentMonth === 'jan' ? "up" : undefined} 
            delay={0.1}
          />
          <StatCard 
            title="Trámites Digitales" 
            value={stats.totalDigital.toLocaleString()} 
            icon={Smartphone} 
            description={`Representa el ${stats.digitalPercentage}% del volumen`} 
            delay={0.2}
          />
          <StatCard 
            title="Trámites Presenciales" 
            value={stats.totalTraditional.toLocaleString()} 
            icon={Building2} 
            description={`Representa el ${stats.traditionalPercentage}% del volumen`} 
            delay={0.3}
          />
        </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 gap-6 sm:gap-8">
              {/* Daily Evolution */}
              <DailyEvolutionChart 
                data={filteredData}
                maxProcedures={maxProcedures}
                formatCurrency={formatCurrency}
                CustomLegend={CustomLegend}
                CustomizedDot={CustomizedDot}
                onFilterDate={selectDate}
              />

              {/* Todos los registros filtrados, paginados sin perder resultados */}
              <RefrendoRecordsTable
                records={dashboard.records}
                pagination={dashboard.pagination}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={toggleSort}
                onPageChange={setPage}
                onExport={() => void exportFilteredRecords()}
                exporting={isExporting}
                onRowSelect={selectRecord}
              />

              {/* Revenue Comparison */}
              <RevenueChart 
                monthlyRevenueData={monthlyRevenueData}
                formatCurrency={formatCurrency}
                currentMonth={currentMonth}
                onMonthSelect={selectMonthFromChart}
              />

              {/* Inconspicuous Call to Action */}
              <div id="cta-payments-gestores" className="flex justify-center px-2 py-3 sm:py-4">
                <button
                  type="button"
                  onClick={() => setShowExtraCharts(prev => !prev)}
                  className="flex min-h-11 max-w-full cursor-pointer items-center gap-1.5 border-b border-dashed border-slate-200 pb-1 text-center text-[10px] font-medium uppercase tracking-wider text-slate-400 transition-all duration-300 hover:border-[#2e3b2b]/50 hover:text-[#2e3b2b] focus:outline-none sm:text-[11px]"
                >
                  <span>{showExtraCharts ? 'Ocultar información de pagos y gestores' : 'Consultar información de pagos y gestores'}</span>
                  <motion.span
                    animate={{ rotate: showExtraCharts ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    ↓
                  </motion.span>
                </button>
              </div>

              {/* Collapsed Extra Charts */}
              <AnimatePresence initial={false}>
                {showExtraCharts && (
                  <motion.div
                    key="extra-charts"
                    initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                    animate={{ opacity: 1, height: 'auto', transition: { duration: 0.5, ease: 'easeOut' } }}
                    exit={{ opacity: 0, height: 0, transition: { duration: 0.4, ease: 'easeIn' } }}
                    className="space-y-8"
                  >
                    {/* Daily Revenue (Pagos) */}
                    <DailyRevenueChart 
                      data={revenueData}
                      currentMonth={currentMonth}
                      accumulatedRevenue={accumulatedRevenue}
                      formatCurrency={formatCurrency}
                      CustomLegend={CustomLegend}
                      onDateSelect={selectRevenueDate}
                    />

                    {/* Gestores Section */}
                    <GestoresChart 
                      gestoresData={gestoresData}
                      totalGestores={totalGestores}
                      formatCurrency={formatCurrency}
                      CustomLegend={CustomLegend}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer Note */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="pt-8 border-t border-slate-100"
              >
                <p className="text-[10px] sm:text-xs text-slate-400 italic text-center max-w-4xl mx-auto leading-relaxed">
                  La información de recaudación para los meses de febrero y marzo se tomó de la API de polizas brindada por administración y finanzas, la de enero está consultandose para alinear nuestra data con lo reportado por finanzas.
                </p>
              </motion.div>
            </div>
      </main>
      )}
    </div>
  );
};


function monthKeyFromNumber(month: number): MonthKey | null {
  const entry = (Object.entries(MONTH_CONFIG) as Array<[MonthKey, (typeof MONTH_CONFIG)[MonthKey]]>)
    .find(([, config]) => config.id === month);
  return entry?.[0] ?? null;
}

function monthKeyFromLabel(label: string): MonthKey | null {
  const normalized = label.trim().slice(0, 3).toLocaleLowerCase('es-MX');
  const entry = (Object.entries(MONTH_CONFIG) as Array<[MonthKey, (typeof MONTH_CONFIG)[MonthKey]]>)
    .find(([, config]) => config.short.toLocaleLowerCase('es-MX') === normalized);
  return entry?.[0] ?? null;
}

function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


function downloadCsv(filename: string, headers: Array<string | number>, rows: Array<Array<unknown>>) {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
