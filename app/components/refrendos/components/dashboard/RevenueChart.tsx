import React, { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { DollarSign } from 'lucide-react';
import { SafeResponsiveContainer } from '../../../SafeResponsiveContainer';
import type { RevenueDataset } from '../../services/dataService';
import { COLORS } from '../../constants';
import { ChartContainer } from './ChartContainer';
import { CustomTooltip } from './CustomTooltip';
import { SeriesSummary } from './SeriesSummary';

interface RevenueChartProps {
  refrendoData: RevenueDataset;
  licenciasData: RevenueDataset;
  formatCurrency: (value: number) => string;
  onMonthSelect?: (monthName: string) => void;
  loading?: boolean;
  error?: string | null;
}

type RevenueKpis = {
  actualKey: string;
  projectedKey: string;
  projectedToCutoff: number;
  fullProjectedToCutoffMonth: number;
  actualToCutoff: number;
  periodRangeLabel: string;
  cutoffLabel: string;
  cutoffDescription: string;
  hasCutoffDate: boolean;
};

const MONTH_FULL_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const FIXED_YEAR_COLORS: Record<number, string> = {
  2021: COLORS.year2021,
  2022: COLORS.year2022,
  2023: COLORS.year2023,
  2024: COLORS.year2024,
  2025: COLORS.year2025,
  2026: COLORS.year2026,
};

const FALLBACK_YEAR_COLORS = [
  '#64748b', '#8A495D', '#2E332A', '#3b82f6', '#7c3aed', '#0891b2', '#be123c',
];

function numericValue(item: Record<string, unknown>, key: string): number {
  const value = item[key];
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function yearColor(year: number, index: number): string {
  return FIXED_YEAR_COLORS[year] ?? FALLBACK_YEAR_COLORS[index % FALLBACK_YEAR_COLORS.length];
}

function calculateRevenueKpis(dataset: RevenueDataset): RevenueKpis {
  const activeYear = dataset.activeYear;
  const actualKey = `year${activeYear}CuentaComprobada`;
  const projectedKey = `year${activeYear}Projected`;

  const parsedCutoff = dataset.cutoffDate
    ? new Date(`${dataset.cutoffDate}T12:00:00`)
    : null;
  const hasCutoffDate = Boolean(parsedCutoff && !Number.isNaN(parsedCutoff.getTime()));

  const latestActualMonth = dataset.months.reduce((latest, item) => {
    return item[actualKey] !== undefined ? Math.max(latest, item.monthIndex) : latest;
  }, 0);

  const fallbackMonthIndex = latestActualMonth || 1;
  const validCutoff = hasCutoffDate
    ? parsedCutoff as Date
    : new Date(activeYear, fallbackMonthIndex, 0, 12);

  const cutoffMonthIndex = validCutoff.getMonth() + 1;
  const cutoffDay = validCutoff.getDate();
  const daysInCutoffMonth = new Date(activeYear, cutoffMonthIndex, 0).getDate();
  const cutoffFactor = hasCutoffDate
    ? Math.min(Math.max(cutoffDay / daysInCutoffMonth, 0), 1)
    : 1;

  let projectedToCutoff = 0;
  let fullProjectedToCutoffMonth = 0;
  let actualToCutoff = 0;

  for (const item of dataset.months) {
    if (item.monthIndex > cutoffMonthIndex) continue;

    const projected = numericValue(item, projectedKey);
    const actual = numericValue(item, actualKey);

    fullProjectedToCutoffMonth += projected;
    projectedToCutoff += item.monthIndex === cutoffMonthIndex
      ? projected * cutoffFactor
      : projected;
    actualToCutoff += actual;
  }

  const shortMonth = dataset.months[cutoffMonthIndex - 1]?.monthName ?? '';
  const isCompleteMonth = cutoffDay >= daysInCutoffMonth;
  const periodRangeLabel = hasCutoffDate && !isCompleteMonth
    ? `Ene–${cutoffDay} ${shortMonth}`
    : `Ene–${shortMonth}`;

  return {
    actualKey,
    projectedKey,
    projectedToCutoff,
    fullProjectedToCutoffMonth,
    actualToCutoff,
    periodRangeLabel,
    cutoffLabel: hasCutoffDate ? `${cutoffDay} ${shortMonth}` : shortMonth,
    cutoffDescription: hasCutoffDate
      ? `${cutoffDay} de ${MONTH_FULL_NAMES[cutoffMonthIndex - 1]} de ${activeYear}`
      : 'Sin fecha de corte registrada',
    hasCutoffDate,
  };
}


function selectedMonthFromChartState(state: unknown): string | null {
  if (!state || typeof state !== 'object' || !("activePayload" in state)) return null;
  const activePayload = (state as { activePayload?: unknown }).activePayload;
  if (!Array.isArray(activePayload) || activePayload.length === 0) return null;

  const first = activePayload[0];
  if (!first || typeof first !== 'object' || !("payload" in first)) return null;
  const payload = (first as { payload?: unknown }).payload;
  if (!payload || typeof payload !== 'object' || !("monthName" in payload)) return null;

  const monthName = (payload as { monthName?: unknown }).monthName;
  return typeof monthName === 'string' ? monthName : null;
}

function statusClasses(actual: number, projected: number) {
  if (actual > projected) {
    return {
      background: 'bg-[#2e3b2b]/5',
      text: 'text-[#2e3b2b]',
      border: 'border-[#2e3b2b]/20',
      label: 'Meta Superada',
    };
  }

  if (actual < projected * 0.85) {
    return {
      background: 'bg-red-50/50',
      text: 'text-red-700',
      border: 'border-red-100',
      label: 'Déficit Significativo',
    };
  }

  return {
    background: 'bg-[#7c4a36]/5',
    text: 'text-[#7c4a36]',
    border: 'border-[#7c4a36]/20',
    label: 'Bajo la Meta',
  };
}

export const RevenueChart: React.FC<RevenueChartProps> = ({
  refrendoData,
  licenciasData,
  formatCurrency,
  onMonthSelect,
  loading = false,
  error = null,
}) => {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const [activeChartTab, setActiveChartTab] = useState<'refrendo' | 'licencias'>('refrendo');

  const selectedDataset = activeChartTab === 'refrendo' ? refrendoData : licenciasData;
  const refrendoKpis = useMemo(() => calculateRevenueKpis(refrendoData), [refrendoData]);
  const licenciasKpis = useMemo(() => calculateRevenueKpis(licenciasData), [licenciasData]);

  const historicalYears = useMemo(
    () => refrendoData.years.filter((year) => year !== refrendoData.activeYear),
    [refrendoData.activeYear, refrendoData.years],
  );

  const refrendoSummaryKeys = useMemo(
    () => [
      refrendoKpis.projectedKey,
      refrendoKpis.actualKey,
      ...[...historicalYears].sort((left, right) => right - left).map((year) => `year${year}`),
    ],
    [historicalYears, refrendoKpis.actualKey, refrendoKpis.projectedKey],
  );

  const refrendoSummaryColors = useMemo(() => {
    const colors: Record<string, string> = {
      [refrendoKpis.projectedKey]: COLORS.year2026Projected,
      [refrendoKpis.actualKey]: COLORS.year2026,
    };

    historicalYears.forEach((year, index) => {
      colors[`year${year}`] = yearColor(year, index);
    });
    return colors;
  }, [historicalYears, refrendoKpis.actualKey, refrendoKpis.projectedKey]);

  const licenciasSummaryColors = useMemo(() => ({
    [licenciasKpis.projectedKey]: '#818cf8',
    [licenciasKpis.actualKey]: '#4f46e5',
  }), [licenciasKpis.actualKey, licenciasKpis.projectedKey]);

  const handleLegendClick = (entry: unknown) => {
    const dataKey = entry && typeof entry === 'object' && 'dataKey' in entry
      && typeof (entry as { dataKey?: unknown }).dataKey === 'string'
      ? (entry as { dataKey: string }).dataKey
      : '';
    if (!dataKey) return;
    setHiddenSeries((current) => (
      current.includes(dataKey)
        ? current.filter((key) => key !== dataKey)
        : [...current, dataKey]
    ));
  };

  const refrendoDifference = refrendoKpis.actualToCutoff - refrendoKpis.projectedToCutoff;
  const refrendoMetaSuperada = refrendoDifference > 0;
  const refrendoStatus = statusClasses(
    refrendoKpis.actualToCutoff,
    refrendoKpis.projectedToCutoff,
  );

  const licenciasDifference = licenciasKpis.actualToCutoff - licenciasKpis.projectedToCutoff;
  const licenciasMetaSuperada = licenciasDifference > 0;
  const licenciasStatus = statusClasses(
    licenciasKpis.actualToCutoff,
    licenciasKpis.projectedToCutoff,
  );

  const controls = (
    <div className="flex w-full shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto">
      <button
        type="button"
        onClick={() => setActiveChartTab('refrendo')}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none transition-all focus:outline-none sm:flex-none sm:text-sm ${
          activeChartTab === 'refrendo'
            ? 'bg-white text-brand-dark shadow-sm'
            : 'text-slate-500 hover:bg-slate-200/50 hover:text-brand-dark'
        }`}
      >
        Refrendo
      </button>
      <button
        type="button"
        onClick={() => setActiveChartTab('licencias')}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold outline-none transition-all focus:outline-none sm:flex-none sm:text-sm ${
          activeChartTab === 'licencias'
            ? 'bg-white text-brand-dark shadow-sm'
            : 'text-slate-500 hover:bg-slate-200/50 hover:text-brand-dark'
        }`}
      >
        Licencias
      </button>
    </div>
  );

  const minYear = selectedDataset.years.at(0) ?? selectedDataset.activeYear;
  const description = activeChartTab === 'refrendo'
    ? `Histórico ${minYear} - ${selectedDataset.activeYear}`
    : `${selectedDataset.cri ?? 'CRI 4.3.4.13'} - Licencias de Conducir`;

  return (
    <ChartContainer
      title="Comparativa de Recaudación"
      description={description}
      icon={<DollarSign className="h-5 w-5 text-brand-dark" />}
      controls={controls}
    >
      {loading ? (
        <div className="flex min-h-[260px] items-center justify-center text-sm font-medium text-slate-500">
          Consultando recaudación en Supabase…
        </div>
      ) : error ? (
        <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-red-100 bg-red-50/50 p-6 text-center text-sm font-medium text-red-700">
          {error}
        </div>
      ) : activeChartTab === 'refrendo' ? (
        <>
          <div className="mb-6 flex flex-col gap-6">
            <SeriesSummary
              data={refrendoData.months}
              keys={refrendoSummaryKeys}
              colors={refrendoSummaryColors}
              formatMoney
              formatCurrency={formatCurrency}
            />

            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 transition-all">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                    Proyectado al corte ({refrendoKpis.periodRangeLabel})
                  </p>
                  <p className="font-mono text-base font-bold text-slate-800 sm:text-lg">
                    {formatCurrency(refrendoKpis.projectedToCutoff)}
                  </p>
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  Proyección al corte ({refrendoKpis.cutoffLabel}) (Base hasta el mes: {formatCurrency(refrendoKpis.fullProjectedToCutoffMonth)})
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 transition-all">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                    Recaudado ({refrendoKpis.periodRangeLabel})
                  </p>
                  <p className="font-mono text-base font-bold text-slate-800 sm:text-lg">
                    {formatCurrency(refrendoKpis.actualToCutoff)}
                  </p>
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  Cifra acumulada de cuenta comprobada
                </p>
              </div>

              <div className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-300 ${refrendoStatus.background} ${refrendoStatus.border}`}>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-[11px]">
                      Diferencia (Recaudado - Meta)
                    </p>
                    <span className={`rounded-full border border-current/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest sm:text-[9px] ${refrendoStatus.background} ${refrendoStatus.text}`}>
                      {refrendoStatus.label}
                    </span>
                  </div>
                  <p className={`font-mono text-base font-bold sm:text-lg ${refrendoStatus.text}`}>
                    {refrendoMetaSuperada ? '+ ' : '- '}{formatCurrency(Math.abs(refrendoDifference))}
                  </p>
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  {refrendoMetaSuperada
                    ? 'Superávit registrado en el periodo (+)'
                    : 'Faltante para cubrir la meta al corte'}
                </p>
              </div>
            </div>
          </div>

          <div className="h-[270px] w-full sm:h-[340px]">
            <SafeResponsiveContainer>
              <AreaChart
                data={refrendoData.months}
                margin={{ top: 10, right: 8, left: -8, bottom: 0 }}
                onClick={(state) => {
                  const monthName = selectedMonthFromChartState(state);
                  if (monthName) onMonthSelect?.(monthName);
                }}
                style={{ cursor: onMonthSelect ? 'pointer' : 'default' }}
              >
                <defs>
                  {historicalYears.map((year, index) => (
                    <linearGradient key={year} id={`colorRevenue${year}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={yearColor(year, index)} stopOpacity={0.18} />
                      <stop offset="95%" stopColor={yearColor(year, index)} stopOpacity={0} />
                    </linearGradient>
                  ))}
                  <linearGradient id="colorRevenueActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.year2026} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={COLORS.year2026} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="monthName" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip chartData={refrendoData.months} formatCurrency={formatCurrency} />} />
                <Legend onClick={handleLegendClick} />

                {historicalYears.map((year, index) => {
                  const key = `year${year}`;
                  const color = yearColor(year, index);
                  return (
                    <Area
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={String(year)}
                      stroke={color}
                      fill={`url(#colorRevenue${year})`}
                      fillOpacity={hiddenSeries.includes(key) ? 0 : 1}
                      strokeWidth={year === historicalYears.at(-1) ? 3 : 2}
                      strokeOpacity={hiddenSeries.includes(key) ? 0 : 0.9}
                      hide={hiddenSeries.includes(key)}
                      isAnimationActive={false}
                    />
                  );
                })}

                <Area
                  type="monotone"
                  dataKey={refrendoKpis.projectedKey}
                  name={`${refrendoData.activeYear} Proyectado`}
                  stroke={COLORS.year2026Projected}
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={hiddenSeries.includes(refrendoKpis.projectedKey)}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey={refrendoKpis.actualKey}
                  name={String(refrendoData.activeYear)}
                  stroke={COLORS.year2026}
                  fill="url(#colorRevenueActual)"
                  fillOpacity={hiddenSeries.includes(refrendoKpis.actualKey) ? 0 : 1}
                  strokeWidth={4}
                  dot={{ r: 8, fill: COLORS.year2026, stroke: '#fff', strokeWidth: 3 }}
                  hide={hiddenSeries.includes(refrendoKpis.actualKey)}
                  isAnimationActive={false}
                />
              </AreaChart>
            </SafeResponsiveContainer>
          </div>
          <p className="mt-4 text-[10px] italic text-slate-400">
            {refrendoKpis.hasCutoffDate
              ? `Última fecha de corte registrada: ${refrendoKpis.cutoffDescription}.`
              : 'No hay una fecha de corte registrada para la recaudación de Refrendo.'}
          </p>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-6">
            <SeriesSummary
              data={licenciasData.months}
              keys={[licenciasKpis.projectedKey, licenciasKpis.actualKey]}
              colors={licenciasSummaryColors}
              formatMoney
              formatCurrency={formatCurrency}
            />

            <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 transition-all">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                    Proyectado al corte ({licenciasKpis.periodRangeLabel})
                  </p>
                  <p className="font-mono text-base font-bold text-slate-800 sm:text-lg">
                    {formatCurrency(licenciasKpis.projectedToCutoff)}
                  </p>
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  Proyección al corte ({licenciasKpis.cutoffLabel}) (Base hasta el mes: {formatCurrency(licenciasKpis.fullProjectedToCutoffMonth)})
                </p>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-slate-100 bg-slate-50/40 p-3.5 transition-all">
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:text-[11px]">
                    Recaudado ({licenciasKpis.periodRangeLabel})
                  </p>
                  <p className="font-mono text-base font-bold text-slate-800 sm:text-lg">
                    {formatCurrency(licenciasKpis.actualToCutoff)}
                  </p>
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  Cifra acumulada de cuenta comprobada
                </p>
              </div>

              <div className={`flex flex-col justify-between rounded-xl border p-3.5 transition-all duration-300 ${licenciasStatus.background} ${licenciasStatus.border}`}>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-[11px]">
                      Diferencia (Recaudado - Meta)
                    </p>
                    <span className={`rounded-full border border-current/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest sm:text-[9px] ${licenciasStatus.background} ${licenciasStatus.text}`}>
                      {licenciasStatus.label}
                    </span>
                  </div>
                  <p className={`font-mono text-base font-bold sm:text-lg ${licenciasStatus.text}`}>
                    {licenciasMetaSuperada ? '+ ' : '- '}{formatCurrency(Math.abs(licenciasDifference))}
                  </p>
                </div>
                <p className="mt-2 text-[9px] text-slate-400">
                  {licenciasMetaSuperada
                    ? 'Superávit registrado en el periodo (+)'
                    : 'Faltante para cubrir la meta al corte'}
                </p>
              </div>
            </div>
          </div>

          <div className="h-[270px] w-full sm:h-[340px]">
            <SafeResponsiveContainer>
              <AreaChart
                data={licenciasData.months}
                margin={{ top: 10, right: 8, left: -8, bottom: 0 }}
                onClick={(state) => {
                  const monthName = selectedMonthFromChartState(state);
                  if (monthName) onMonthSelect?.(monthName);
                }}
                style={{ cursor: onMonthSelect ? 'pointer' : 'default' }}
              >
                <defs>
                  <linearGradient id="colorLicenciasRecaudado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="monthName" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip chartData={licenciasData.months} formatCurrency={formatCurrency} />} />
                <Legend onClick={handleLegendClick} />

                <Area
                  type="monotone"
                  dataKey={licenciasKpis.projectedKey}
                  name={`${licenciasData.activeYear} Proyectado`}
                  stroke="#818cf8"
                  fill="none"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={hiddenSeries.includes(licenciasKpis.projectedKey)}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey={licenciasKpis.actualKey}
                  name={String(licenciasData.activeYear)}
                  stroke="#4f46e5"
                  fill="url(#colorLicenciasRecaudado)"
                  fillOpacity={hiddenSeries.includes(licenciasKpis.actualKey) ? 0 : 1}
                  strokeWidth={4}
                  dot={{ r: 8, fill: '#4f46e5', stroke: '#fff', strokeWidth: 3 }}
                  hide={hiddenSeries.includes(licenciasKpis.actualKey)}
                  isAnimationActive={false}
                />
              </AreaChart>
            </SafeResponsiveContainer>
          </div>
          <p className="mt-4 text-[10px] italic text-slate-400">
            {licenciasKpis.hasCutoffDate
              ? `Última fecha de corte registrada: ${licenciasKpis.cutoffDescription}.`
              : 'No hay una fecha de corte registrada para la recaudación de Licencias.'}
          </p>
        </>
      )}
    </ChartContainer>
  );
};
