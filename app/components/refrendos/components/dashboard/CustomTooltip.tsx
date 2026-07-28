import React from 'react';
import { cn } from '../../lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface PercentageBadgeProps {
  current: number;
  previous: number;
  year: number;
}

const PercentageBadge: React.FC<PercentageBadgeProps> = ({ current, previous, year }) => {
  if (!previous) return null;
  const percentage = ((current - previous) / previous) * 100;
  const isPositive = percentage >= 0;

  return (
    <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-slate-100 gap-4">
      <span className="text-slate-500 font-medium whitespace-nowrap">
        vs {year}: <span className="text-slate-600 font-mono ml-1">{previous.toLocaleString()}</span>
      </span>
      <div className={cn("flex items-center font-bold", isPositive ? "text-emerald-600" : "text-rose-600")}>
        ({isPositive ? "+" : ""}{percentage.toFixed(1)}%)
      </div>
    </div>
  );
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  view?: string;
  chartData?: any[];
  formatCurrency: (value: number) => string;
  showVariation?: boolean;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({ 
  active, 
  payload, 
  label, 
  view, 
  chartData,
  formatCurrency,
  showVariation = true
}) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const { total, total2024, total2025, gestores, totalGeneral } = data;

    if (gestores !== undefined && totalGeneral !== undefined) {
      const share = (gestores / totalGeneral) * 100;
      return (
        <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-xl z-50 min-w-[160px] sm:min-w-[200px]">
           <p className="font-bold text-brand-dark mb-2 sm:mb-3 text-xs sm:text-sm border-b border-slate-100 pb-1.5 sm:pb-2">{label}</p>
           <div className="flex items-center justify-between gap-4 sm:gap-6 text-xs sm:text-sm mb-1 sm:mb-1.5">
             <span className="text-slate-600 font-medium whitespace-nowrap">Gestores:</span>
             <span className="font-bold font-mono text-brand-wine">{gestores.toLocaleString()}</span>
           </div>
           <div className="flex items-center justify-between gap-4 sm:gap-6 text-xs sm:text-sm mb-1 sm:mb-1.5">
             <span className="text-slate-400 font-medium whitespace-nowrap">Total Mes:</span>
             <span className="font-bold font-mono text-slate-400">{totalGeneral.toLocaleString()}</span>
           </div>
           <div className="mt-1.5 sm:mt-2 pt-1.5 sm:pt-2 border-t border-slate-100">
             <span className="text-[10px] sm:text-xs font-semibold text-brand-primary">Representa el {share.toFixed(1)}% del total</span>
           </div>
        </div>
      )
    }

    const currentIndex = chartData ? chartData.findIndex((item: any) => item.monthName === label || item.date === label) : -1;
    const prevItem = currentIndex > 0 ? chartData[currentIndex - 1] : null;

    return (
      <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-xl z-50 min-w-[160px] sm:min-w-[200px]">
        <p className="font-bold text-brand-dark mb-2 sm:mb-3 text-xs sm:text-sm border-b border-slate-100 pb-1.5 sm:pb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const currentVal = entry.value;
          const prevVal = prevItem ? prevItem[entry.dataKey] : 0;
          const diff = currentVal - prevVal;
          const pct = prevVal ? (diff / prevVal) * 100 : 0;
          const isUp = diff >= 0;
          const isMoney = currentVal > 1000000 || entry.dataKey === 'importe' || entry.name?.toLowerCase().includes('recaudación') || entry.name?.toLowerCase().includes('refrendo público'); 
          const displayValue = isMoney ? formatCurrency(currentVal) : currentVal.toLocaleString();

          return (
            <div key={index} className="flex flex-col mb-1.5 sm:mb-2 last:mb-0">
              <div className="flex items-center justify-between gap-4 sm:gap-6 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color || entry.payload.fill || entry.stroke }} />
                  <span className="text-slate-600 font-medium capitalize truncate max-w-[80px] sm:max-w-none">{entry.name}:</span>
                </div>
                <span className="font-bold font-mono text-slate-800">{displayValue}</span>
              </div>
              
              {showVariation && prevItem && prevVal !== 0 && (
                <div className="flex items-center justify-end gap-1 sm:gap-2 text-[9px] sm:text-[10px] sm:mt-0.5 ml-auto">
                   <span className={cn("flex items-center font-bold", isUp ? "text-emerald-600" : "text-rose-600")}>
                     {isUp ? <ArrowUp className="w-2 h-2 sm:w-2.5 sm:h-2.5" /> : <ArrowDown className="w-2 h-2 sm:w-2.5 sm:h-2.5" />}
                     {Math.abs(pct).toFixed(1)}%
                   </span>
                </div>
              )}
            </div>
          );
        })}
        
        {view === 'total' && (
          <div className="mt-3 bg-slate-50 p-2 rounded-lg">
             <p className="text-[10px] text-slate-400 font-semibold uppercase mb-1">Comparativa Histórica</p>
             {total2025 > 0 && <PercentageBadge current={total} previous={total2025} year={2025} />}
             {total2024 > 0 && <PercentageBadge current={total} previous={total2024} year={2024} />}
          </div>
        )}
      </div>
    );
  }
  return null;
};
