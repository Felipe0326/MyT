import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { ChartContainer } from '@/features/dashboards/shared/components/ChartContainer';
import { COLORS } from '@/features/dashboards/shared/constants';
import type { DailyChartPoint } from '@/features/dashboards/shared/types';

type DailyAggregatedData = {
  date: string;
  fullDate: Date;
  day: number;
  digital: number;
  traditional: number;
  unclassified: number;
  total: number;
};

interface DailyEvolutionChartProps {
  data: DailyChartPoint[];
  maxProcedures: number;
  onFilterDate?: (date: Date) => void;
  description?: string;
}

type DailyTooltipEntry = {
  name?: string | number;
  value?: string | number;
  color?: string;
};

function DailyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: DailyTooltipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[180px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
      <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-bold text-brand-dark">
        {label}
      </p>
      {payload.map((entry) => (
        <div key={String(entry.name)} className="flex items-center justify-between gap-5 py-1 text-xs">
          <span className="flex items-center gap-2 font-medium text-slate-600">
            <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <strong className="font-mono text-slate-800">{Number(entry.value ?? 0).toLocaleString('es-MX')}</strong>
        </div>
      ))}
    </div>
  );
}

export const DailyEvolutionChart: React.FC<DailyEvolutionChartProps> = ({
  data,
  maxProcedures,
  onFilterDate,
  description = "Modalidad presencial vs digital. Selecciona un día para filtrar todo el tablero.",
}) => {
  const dailyData = useMemo(() => {
    const map = new Map<string, DailyAggregatedData>();

    data.forEach((item) => {
      const current = map.get(item.date) ?? {
          date: item.date,
          fullDate: item.fullDate,
          day: item.day,
          digital: 0,
          traditional: 0,
          unclassified: 0,
          total: 0,
        };
      current.digital += item.digital || 0;
      current.traditional += item.traditional || 0;
      current.unclassified += item.unclassified || 0;
      current.total += item.total || 0;
      map.set(item.date, current);
    });

    return Array.from(map.values()).sort(
      (left, right) => left.fullDate.getTime() - right.fullDate.getTime(),
    );
  }, [data]);

  const hasUnclassified = dailyData.some((item) => item.unclassified > 0);
  const spansMultipleMonths = dailyData.some((item) => (
    item.fullDate.getMonth() !== dailyData[0]?.fullDate.getMonth()
    || item.fullDate.getFullYear() !== dailyData[0]?.fullDate.getFullYear()
  ));
  const spansMultipleYears = dailyData.some((item) => (
    item.fullDate.getFullYear() !== dailyData[0]?.fullDate.getFullYear()
  ));
  const monthlyTicks = useMemo(() => {
    const firstDateByMonth = new Map<string, { value: string; label: string }>();

    dailyData.forEach((item) => {
      const key = `${item.fullDate.getFullYear()}-${item.fullDate.getMonth()}`;
      if (firstDateByMonth.has(key)) return;

      const month = new Intl.DateTimeFormat('es-MX', { month: 'short' })
        .format(item.fullDate)
        .replace('.', '');
      const monthLabel = month.charAt(0).toLocaleUpperCase('es-MX') + month.slice(1);
      firstDateByMonth.set(key, {
        value: item.date,
        label: spansMultipleYears ? `${monthLabel} ${item.fullDate.getFullYear()}` : monthLabel,
      });
    });

    return Array.from(firstDateByMonth.values());
  }, [dailyData, spansMultipleYears]);
  const monthlyTickLabels = useMemo(
    () => new Map(monthlyTicks.map((tick) => [tick.value, tick.label])),
    [monthlyTicks],
  );
  const dataMaximum = dailyData.reduce((maximum, item) => Math.max(
    maximum,
    item.digital,
    item.traditional,
    item.unclassified,
  ), 0);

  const yAxisMax = Math.max(100, Math.ceil(Math.max(maxProcedures, dataMaximum) / 100) * 100);

  return (
    <ChartContainer
      title="Evolución diaria de trámites"
      description={spansMultipleMonths
        ? `${description} La gráfica conserva un punto por día y el eje muestra una referencia por mes.`
        : description}
    >
      <div className="h-[260px] w-full sm:h-[340px]">
        <SafeResponsiveContainer>
          <AreaChart
            data={dailyData}
            margin={{ top: 10, right: 6, left: -8, bottom: 0 }}
            onClick={(state) => {
              const index = typeof state?.activeTooltipIndex === 'number'
                ? state.activeTooltipIndex
                : -1;
              const row = index >= 0 ? dailyData[index] : undefined;
              if (row?.fullDate && onFilterDate) onFilterDate(row.fullDate);
            }}
            style={{ cursor: onFilterDate ? 'pointer' : 'default' }}
          >
            <defs>
              <linearGradient id="colorDigital" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.digital} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.digital} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorTrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.traditional} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.traditional} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorUnclassified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
              tickMargin={10}
              ticks={spansMultipleMonths ? monthlyTicks.map((tick) => tick.value) : undefined}
              interval={spansMultipleMonths ? 0 : 'preserveStartEnd'}
              minTickGap={20}
              tickFormatter={(value: string) => spansMultipleMonths
                ? (monthlyTickLabels.get(value) ?? value)
                : value.split('/')[0]}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
              domain={[0, yAxisMax]}
              width={45}
            />
            <Tooltip content={<DailyTooltip />} />
            <Legend
              verticalAlign="top"
              align="right"
              height={36}
              iconType="circle"
              iconSize={6}
              formatter={(value) => <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500 sm:text-xs">{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="digital"
              name="Digital"
              stroke={COLORS.digital}
              strokeWidth={3}
              fill="url(#colorDigital)"
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.digital }} isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="traditional"
              name="Presencial"
              stroke={COLORS.traditional}
              strokeWidth={3}
              fill="url(#colorTrad)"
              fillOpacity={1}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.traditional }} isAnimationActive={false}
            />
            {hasUnclassified && (
              <Area
                type="monotone"
                dataKey="unclassified"
                name="Sin clasificar"
                stroke="#94a3b8"
                strokeWidth={2}
                fill="url(#colorUnclassified)"
                fillOpacity={1}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 0, fill: '#94a3b8' }}
                isAnimationActive={false}
              />
            )}
          </AreaChart>
        </SafeResponsiveContainer>
      </div>
    </ChartContainer>
  );
};
