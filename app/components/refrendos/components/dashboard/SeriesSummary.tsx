import React from 'react';
import { cn } from '../../lib/utils';

interface SeriesSummaryProps {
  data: any[];
  keys: string[];
  colors: Record<string, string>;
  formatMoney?: boolean;
  className?: string;
  vertical?: boolean;
  formatCurrency: (value: number) => string;
}

export const SeriesSummary: React.FC<SeriesSummaryProps> = ({ 
  data, 
  keys, 
  colors, 
  formatMoney, 
  className, 
  vertical,
  formatCurrency
}) => {
  const totals = keys.reduce((acc: any, key: string) => {
    acc[key] = data.reduce((sum: number, item: any) => sum + (item[key] || 0), 0);
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={cn(
      "z-20 flex min-w-0 max-w-full text-xs", 
      vertical ? "flex-col gap-1.5" : "flex-wrap gap-2",
      className
    )}>
      {keys.map((key: string) => (
        <div key={key} className={cn(
          "flex min-w-0 items-center gap-2 rounded-md border px-2 py-1.5 shadow-sm backdrop-blur-[2px]",
          vertical ? "bg-white/90 border-slate-200 min-w-[120px]" : "bg-slate-50 border-slate-100"
        )}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: colors[key] || '#cbd5e1' }} />
          <span className="font-bold text-slate-500 uppercase text-[10px] min-w-[2.5rem]">{key.replace('year', '').replace('Projected', ' Proy').replace('CuentaComprobada', '')}:</span>
          <span className="min-w-0 break-words font-mono font-bold text-slate-700">
            {formatMoney ? formatCurrency(totals[key]) : totals[key].toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};
