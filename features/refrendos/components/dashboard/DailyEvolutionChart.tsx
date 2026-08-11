import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { SafeResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { ChartContainer } from './ChartContainer';
import { CustomTooltip } from './CustomTooltip';
import { COLORS } from '../../constants';
import type { TramiteData } from '../../services/dataService';

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
  data: TramiteData[];
  maxProcedures: number;
  formatCurrency: (value: number) => string;
  onFilterDate?: (date: Date) => void;
  description?: string;
}

export const DailyEvolutionChart: React.FC<DailyEvolutionChartProps> = ({
  data,
  maxProcedures,
  formatCurrency,
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

    return Array.from(map.values()).sort((left, right) => left.day - right.day);
  }, [data]);

  const hasUnclassified = dailyData.some((item) => item.unclassified > 0);

  const yAxisMax = Math.max(100, Math.ceil(maxProcedures / 100) * 100);

  return (
    <ChartContainer
      title="Evolución diaria de trámites"
      description={description}
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
              minTickGap={20}
              tickFormatter={(value: string) => value.split('/')[0]}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
              domain={[0, yAxisMax]}
              width={45}
            />
            <Tooltip content={<CustomTooltip view="split" chartData={dailyData} formatCurrency={formatCurrency} showVariation={false} />} />
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
