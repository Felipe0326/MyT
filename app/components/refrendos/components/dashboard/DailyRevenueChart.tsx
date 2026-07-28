import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { SafeResponsiveContainer } from '../../../SafeResponsiveContainer';
import { ChartContainer } from './ChartContainer';
import { CustomTooltip } from './CustomTooltip';
import { DollarSign } from 'lucide-react';
import { COLORS } from '../../constants';
import { DailyRevenueData } from '../../services/dataService';

interface DailyRevenueChartProps {
  data: DailyRevenueData[];
  currentMonth: 'jan' | 'feb' | 'mar' | 'abr' | 'may' | 'jun' | 'jul';
  accumulatedRevenue: number;
  formatCurrency: (value: number) => string;
  CustomLegend: (value: string) => React.ReactNode;
  onDateSelect?: (date: string) => void;
}

export const DailyRevenueChart: React.FC<DailyRevenueChartProps> = ({
  data,
  currentMonth,
  accumulatedRevenue,
  formatCurrency,
  CustomLegend,
  onDateSelect,
}) => {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalRevenue = data.reduce((acc, curr) => acc + curr.publico + curr.privado, 0);

  const monthMap = {
    jan: { name: 'Enero', short: 'Ene' },
    feb: { name: 'Febrero', short: 'Feb' },
    mar: { name: 'Marzo', short: 'Mar' },
    abr: { name: 'Abril', short: 'Abr' },
    may: { name: 'Mayo', short: 'May' },
    jun: { name: 'Junio', short: 'Jun' },
    jul: { name: 'Julio', short: 'Jul' }
  };
  const { name: monthName, short: monthShort } = monthMap[currentMonth];

  return (
    <ChartContainer
      title="Pagos registrados"
      icon={<DollarSign className="w-5 h-5 text-brand-primary" />}
      controls={
        <div className="grid w-full grid-cols-1 gap-2 min-[440px]:grid-cols-2">
          <div className="bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-slate-200 shadow-sm flex-1">
             <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Total {monthShort}</span>
             <span className="text-base sm:text-lg font-bold text-brand-primary leading-tight">
               {formatCurrency(totalRevenue)}
             </span>
          </div>
          <div className="bg-brand-dark px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-brand-dark shadow-sm flex-1">
             <span className="text-[10px] text-brand-secondary/80 font-bold uppercase block mb-0.5 text-white">Acumulado</span>
             <span className="text-base sm:text-lg font-bold text-brand-secondary leading-tight">
               {formatCurrency(accumulatedRevenue)}
             </span>
          </div>
        </div>
      }
    >
      <div className="h-[260px] w-full sm:h-[340px]">
        <SafeResponsiveContainer>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 6, left: -8, bottom: 0 }}
            onClick={(state) => {
              const row = state?.activePayload?.[0]?.payload as { date?: string } | undefined;
              if (row?.date) onDateSelect?.(row.date);
            }}
            style={{ cursor: onDateSelect ? 'pointer' : 'default' }}
          >
            <defs>
              <linearGradient id="colorPublico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.digital} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.digital} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPrivado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.traditional} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={COLORS.traditional} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
            <XAxis 
              dataKey="date" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} 
              tickMargin={10} 
              minTickGap={20} 
              tickFormatter={(value) => value.split('/')[0]} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} 
              tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} 
              width={55}
            />
            <Tooltip content={<CustomTooltip view="revenue" chartData={data} formatCurrency={formatCurrency} showVariation={false} />} />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36} 
              iconType="circle" 
              iconSize={6} 
              formatter={(value) => <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">{value}</span>} 
            />
            <Area 
              type="monotone" 
              dataKey="publico" 
              name="Refrendo Público" 
              stroke={COLORS.digital} 
              strokeWidth={3} 
              fill="url(#colorPublico)" 
              fillOpacity={1} 
              dot={false} 
              activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.digital }} isAnimationActive={false} 
            />
            <Area 
              type="monotone" 
              dataKey="privado" 
              name="Refrendo Privado" 
              stroke={COLORS.traditional} 
              strokeWidth={3} 
              fill="url(#colorPrivado)" 
              fillOpacity={1} 
              dot={false} 
              activeDot={{ r: 6, strokeWidth: 0, fill: COLORS.traditional }} isAnimationActive={false} 
            />
          </AreaChart>
        </SafeResponsiveContainer>
      </div>
    </ChartContainer>
  );
};
