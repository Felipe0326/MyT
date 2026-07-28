import React from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { ToggleBtn } from './ToggleBtn';
import { CustomTooltip } from './CustomTooltip';
import { SeriesSummary } from './SeriesSummary';
import { History, BarChart3, LineChart as LineChartIcon } from 'lucide-react';
import { COLORS } from '../../constants';

interface HistoricalChartProps {
  historicalData: any[];
  historicalMonthlyData: any[];
  historicalView: 'annual' | 'monthly';
  setHistoricalView: (view: 'annual' | 'monthly') => void;
  currentMonth: 'jan' | 'feb';
  val2026?: number;
  formatCurrency: (value: number) => string;
  CustomLegend: (value: string) => React.ReactNode;
}

export const HistoricalChart: React.FC<HistoricalChartProps> = ({
  historicalData,
  historicalMonthlyData,
  historicalView,
  setHistoricalView,
  currentMonth,
  val2026,
  formatCurrency,
  CustomLegend
}) => {
  return (
    <ChartContainer
      title="Total de trámites realizados por mes"
      description={historicalView === 'annual' ? `Comparativa Anual - ${currentMonth === 'jan' ? 'Enero' : 'Febrero'}` : "Distribución Mensual (2021-2026)"}
      icon={<History className="w-5 h-5 text-brand-brown" />}
      controls={
        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
          <ToggleBtn active={historicalView === 'annual'} onClick={() => setHistoricalView('annual')} icon={BarChart3} label="Total Anual" />
          <ToggleBtn active={historicalView === 'monthly'} onClick={() => setHistoricalView('monthly')} icon={LineChartIcon} label="Mensual" />
        </div>
      }
    >
      <div className="h-[280px] sm:h-[350px] w-full relative">
        {historicalView === 'monthly' && (
          <SeriesSummary 
            data={historicalMonthlyData} 
            keys={['year2026', 'year2025', 'year2024', 'year2023', 'year2022', 'year2021']} 
            colors={{
              year2026: COLORS.historyLine[2026],
              year2025: COLORS.historyLine[2025],
              year2024: COLORS.historyLine[2024],
              year2023: COLORS.historyLine[2023],
              year2022: COLORS.historyLine[2022],
              year2021: COLORS.historyLine[2021]
            }} 
            vertical={true}
            className="absolute top-0 right-0 z-10 hidden xs:flex"
            formatCurrency={formatCurrency}
          />
        )}
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          {historicalView === 'annual' ? (
            <BarChart data={historicalData} margin={{ top: 30, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.brown} stopOpacity={0.8}/><stop offset="95%" stopColor={COLORS.brown} stopOpacity={0.6}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
              <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 600 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(value) => `${value / 1000}k`} width={40} />
              <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ fill: '#f1f5f9' }} />
              <Legend 
                verticalAlign="top" 
                align="right" 
                height={36} 
                iconType="circle" 
                iconSize={6} 
                formatter={(value) => <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">{value}</span>} 
              />
              {val2026 && <ReferenceLine y={val2026} stroke={COLORS.traditional} strokeDasharray="3 3" label={{ position: 'right', value: '2026', fill: COLORS.traditional, fontSize: 10, fontWeight: 'bold', dy: -10 }} />}
              <Bar dataKey="total" name="Total Refrendos" fill="url(#colorTotal)" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false}>
                <LabelList dataKey="total" position="top" offset={10} style={{ fill: COLORS.brown, fontSize: '10px', fontWeight: 'bold' }} formatter={(value: number) => value.toLocaleString()} />
                {historicalData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.year === 2026 ? COLORS.traditional : "url(#colorTotal)"} />))}
              </Bar>
            </BarChart>
          ) : (
            <LineChart data={historicalMonthlyData} margin={{ top: 20, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
              <XAxis dataKey="monthName" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} width={40} />
              <Tooltip content={<CustomTooltip chartData={historicalMonthlyData} formatCurrency={formatCurrency} />} />
              <Legend 
                verticalAlign="top" 
                align="right" 
                height={36} 
                iconType="circle" 
                iconSize={6} 
                formatter={(value) => <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">{value}</span>} 
              />
              <Line isAnimationActive={false} type="monotone" dataKey="year2021" name="2021" stroke={COLORS.historyLine[2021]} strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={{r: 4}} />
              <Line isAnimationActive={false} type="monotone" dataKey="year2022" name="2022" stroke={COLORS.historyLine[2022]} strokeWidth={2} strokeDasharray="3 3" dot={false} activeDot={{r: 4}} />
              <Line isAnimationActive={false} type="monotone" dataKey="year2023" name="2023" stroke={COLORS.historyLine[2023]} strokeWidth={2} dot={false} activeDot={{r: 4}} />
              <Line isAnimationActive={false} type="monotone" dataKey="year2024" name="2024" stroke={COLORS.historyLine[2024]} strokeWidth={2.5} dot={false} activeDot={{r: 5}} />
              <Line isAnimationActive={false} type="monotone" dataKey="year2025" name="2025" stroke={COLORS.historyLine[2025]} strokeWidth={3} dot={{r: 2, fill: COLORS.historyLine[2025]}} activeDot={{r: 6}} />
              <Line isAnimationActive={false} type="monotone" dataKey="year2026" name="2026" stroke={COLORS.historyLine[2026]} strokeWidth={3} dot={{r: 3, strokeWidth: 1, stroke: 'white', fill: COLORS.historyLine[2026]}} activeDot={{r: 7}} style={{ filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.1))" }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
};
