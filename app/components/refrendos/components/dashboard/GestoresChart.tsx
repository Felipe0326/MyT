import React from 'react';
import { ComposedChart, Area, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { CustomTooltip } from './CustomTooltip';
import { Users } from 'lucide-react';
import { COLORS } from '../../constants';

interface GestoresChartProps {
  gestoresData: any[];
  totalGestores: number;
  formatCurrency: (value: number) => string;
  CustomLegend: (value: string) => React.ReactNode;
}

export const GestoresChart: React.FC<GestoresChartProps> = ({
  gestoresData,
  totalGestores,
  formatCurrency,
  CustomLegend
}) => {
  return (
    <ChartContainer
      title="Trámites realizados por gestores"
      description="Comparativa: Volumen gestores vs Total mensual (Sep 2025 - Feb 2026)"
      icon={<Users className="w-5 h-5 text-brand-wine" />}
      controls={
        <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm self-start sm:self-auto">
           <span className="text-xs text-slate-500 font-bold uppercase block mb-0.5">Total Gestores</span>
           <span className="text-lg font-bold text-brand-wine">{totalGestores.toLocaleString()}</span>
        </div>
      }
      className="mb-8"
    >
      <div className="h-[260px] w-full sm:h-[340px]">
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <ComposedChart data={gestoresData} margin={{ top: 30, right: 6, left: -8, bottom: 5 }}>
             <defs>
              <linearGradient id="colorGestoresLine" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.traditional} stopOpacity={0.4}/><stop offset="95%" stopColor={COLORS.traditional} stopOpacity={0}/></linearGradient>
              <linearGradient id="colorShadow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1}/><stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/></linearGradient>
            </defs>
            <XAxis dataKey="fullLabel" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }} dy={10} minTickGap={10} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} width={40} />
            <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} cursor={{ stroke: COLORS.traditional, strokeWidth: 1, strokeDasharray: '3 3' }} />
            <Legend 
              verticalAlign="top" 
              align="right" 
              height={36} 
              iconType="circle" 
              iconSize={6} 
              formatter={(value) => <span className="text-[10px] sm:text-xs font-medium text-slate-500 uppercase tracking-wider">{value}</span>} 
            />
            <Area type="monotone" dataKey="totalGeneral" name="Total Trámites" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="4 4" fill="url(#colorShadow)" fillOpacity={1} activeDot={false} isAnimationActive={false} />
            <Area type="monotone" dataKey="gestores" name="Gestores" stroke={COLORS.traditional} strokeWidth={3} fill="url(#colorGestoresLine)" fillOpacity={1} activeDot={{ r: 6, strokeWidth: 2, stroke: 'white', fill: COLORS.traditional }} isAnimationActive={false}>
                 <LabelList dataKey="gestores" position="top" offset={15} style={{ fill: COLORS.traditional, fontSize: '11px', fontWeight: 'bold' }} formatter={(value: number) => value.toLocaleString()} />
            </Area>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
};
