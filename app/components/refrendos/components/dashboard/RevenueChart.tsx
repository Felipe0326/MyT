import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { CustomTooltip } from './CustomTooltip';
import { SeriesSummary } from './SeriesSummary';
import { DollarSign, ShieldAlert, Award } from 'lucide-react';
import { COLORS } from '../../constants';

interface RevenueChartProps {
  monthlyRevenueData: any[];
  formatCurrency: (value: number) => string;
  currentMonth: string;
  onMonthSelect?: (monthName: string) => void;
}

const MONTH_MAP: Record<string, { short: string; fullName: string }> = {
  jan: { short: 'Ene', fullName: 'Enero' },
  feb: { short: 'Feb', fullName: 'Febrero' },
  mar: { short: 'Mar', fullName: 'Marzo' },
  abr: { short: 'Abr', fullName: 'Abril' },
  may: { short: 'May', fullName: 'Mayo' },
  jun: { short: 'Jun', fullName: 'Junio' },
  jul: { short: 'Jul', fullName: 'Julio' },
};

const LICENCIAS_DATA = [
  { monthName: 'Ene', year2026CuentaComprobada: 8274790, year2026Projected: 6589849, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Feb', year2026CuentaComprobada: 6628083, year2026Projected: 6875449, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Mar', year2026CuentaComprobada: 7960014, year2026Projected: 7261266, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Abr', year2026CuentaComprobada: 7450965, year2026Projected: 7071288, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'May', year2026CuentaComprobada: 9860605, year2026Projected: 7366126, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Jun', year2026CuentaComprobada: 9165349, year2026Projected: 9195276, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Jul', year2026CuentaComprobada: 1739684, year2026Projected: 9872629, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Ago', year2026CuentaComprobada: undefined, year2026Projected: 11633176, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Sep', year2026CuentaComprobada: undefined, year2026Projected: 11973087, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Oct', year2026CuentaComprobada: undefined, year2026Projected: 9353328, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Nov', year2026CuentaComprobada: undefined, year2026Projected: 10293844, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
  { monthName: 'Dic', year2026CuentaComprobada: undefined, year2026Projected: 10514682, cri: '4.3.4.13', concepto: 'LICENCIAS PARA MANEJAR VEHÍCULOS' },
];

export const RevenueChart: React.FC<RevenueChartProps> = ({
  monthlyRevenueData,
  formatCurrency,
  currentMonth,
  onMonthSelect,
}) => {
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const [activeChartTab, setActiveChartTab] = useState<'refrendo' | 'licencias'>('refrendo');

  const handleLegendClick = (o: any) => {
    const { dataKey } = o;
    if (hiddenSeries.includes(dataKey)) {
      setHiddenSeries(hiddenSeries.filter(key => key !== dataKey));
    } else {
      setHiddenSeries([...hiddenSeries, dataKey]);
    }
  };

  const monthConfig = MONTH_MAP[currentMonth] || { short: '', fullName: 'Mes seleccionado' };
  const monthItem = monthlyRevenueData.find(
    (item) => item.monthName.toLowerCase() === monthConfig.short.toLowerCase()
  );

  const MONTH_INDICES: Record<string, number> = {
    jan: 1,
    feb: 2,
    mar: 3,
    abr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dic: 12,
  };

  const selectedMonthIndex = MONTH_INDICES[currentMonth] || 1;
  const CUTOFF_MONTH_INDEX = 7; // Julio es el mes en curso del corte
  const CUTOFF_DAY = 7; // Corte al 8 de julio del 2026 (primera semana de julio)

  let accumulatedProjected = 0;
  let accumulatedRecaudado = 0;
  let fullYearProjectedJanJul = 0;

  // Enfoque de enero a julio (índices 0 a 6)
  monthlyRevenueData.slice(0, 7).forEach((item, index) => {
    let monthPercentage = 1.0;
    if (index === 6) { // Julio
      const week = Math.ceil(CUTOFF_DAY / 7);
      if (week === 1) monthPercentage = 0.25;
      else if (week === 2) monthPercentage = 0.50;
      else if (week === 3) monthPercentage = 0.75;
      else monthPercentage = 1.0;
    }
    
    fullYearProjectedJanJul += (item.year2026Projected || 0);
    accumulatedProjected += (item.year2026Projected || 0) * monthPercentage;
    accumulatedRecaudado += (item.year2026CuentaComprobada || 0);
  });

  const card1Value = accumulatedProjected;
  const card2Value = accumulatedRecaudado;
  const periodLabel = `Proyección al corte (7 Jul)`;
  
  // "para la cifra de diferencia; si la meta superada es positiva, debe ser a favor (+)"
  const isMetaSuperada = card2Value > card1Value;
  const card3ValueAbs = Math.abs(card1Value - card2Value);
  const card3Formatted = isMetaSuperada 
    ? `+ ${formatCurrency(card3ValueAbs)}` 
    : `- ${formatCurrency(card3ValueAbs)}`;

  // Conditional styling
  // si card2>card1 = verde // si card2<<<card1= rojo // si card2<card1 = naranja
  let statusBgClass = '';
  let statusTextClass = '';
  let statusBorderClass = '';
  let statusLabel = '';

  if (card2Value > card1Value) {
    statusBgClass = 'bg-[#2e3b2b]/5';
    statusTextClass = 'text-[#2e3b2b]';
    statusBorderClass = 'border-[#2e3b2b]/20';
    statusLabel = 'Meta Superada';
  } else if (card2Value < card1Value * 0.85) {
    statusBgClass = 'bg-red-50/50';
    statusTextClass = 'text-red-700';
    statusBorderClass = 'border-red-100';
    statusLabel = 'Déficit Significativo';
  } else {
    statusBgClass = 'bg-[#7c4a36]/5';
    statusTextClass = 'text-[#7c4a36]';
    statusBorderClass = 'border-[#7c4a36]/20';
    statusLabel = 'Bajo la Meta';
  }

  // Licencias Calculations
  const totalLicencias = useMemo(() => {
    return LICENCIAS_DATA.reduce((acc, curr) => acc + (curr.year2026CuentaComprobada || 0), 0);
  }, []);

  const promedioLicencias = useMemo(() => {
    const monthsWithData = LICENCIAS_DATA.filter(curr => curr.year2026CuentaComprobada !== undefined);
    return totalLicencias / (monthsWithData.length || 1);
  }, [totalLicencias]);

  const peakLicencias = useMemo(() => {
    const monthsWithData = LICENCIAS_DATA.filter(curr => curr.year2026CuentaComprobada !== undefined);
    return [...monthsWithData].sort((a, b) => (b.year2026CuentaComprobada || 0) - (a.year2026CuentaComprobada || 0))[0];
  }, []);

  const licenciasAccumulatedProjected = useMemo(() => {
    let sum = 0;
    LICENCIAS_DATA.slice(0, 7).forEach((item, index) => {
      let monthPercentage = 1.0;
      if (index === 6) { // Julio
        const week = Math.ceil(CUTOFF_DAY / 7);
        if (week === 1) monthPercentage = 0.25;
        else if (week === 2) monthPercentage = 0.50;
        else if (week === 3) monthPercentage = 0.75;
        else monthPercentage = 1.0;
      }
      sum += (item.year2026Projected || 0) * monthPercentage;
    });
    return sum;
  }, [CUTOFF_DAY]);

  const licenciasFullYearProjectedJanJul = useMemo(() => {
    return LICENCIAS_DATA.slice(0, 7).reduce((acc, curr) => acc + (curr.year2026Projected || 0), 0);
  }, []);

  const licenciasAccumulatedRecaudado = totalLicencias;

  const isLicenciasMetaSuperada = licenciasAccumulatedRecaudado > licenciasAccumulatedProjected;
  const licenciasCard3ValueAbs = Math.abs(licenciasAccumulatedProjected - licenciasAccumulatedRecaudado);
  const licenciasCard3Formatted = isLicenciasMetaSuperada 
    ? `+ ${formatCurrency(licenciasCard3ValueAbs)}` 
    : `- ${formatCurrency(licenciasCard3ValueAbs)}`;

  let licenciasStatusBgClass = '';
  let licenciasStatusTextClass = '';
  let licenciasStatusBorderClass = '';
  let licenciasStatusLabel = '';

  if (licenciasAccumulatedRecaudado > licenciasAccumulatedProjected) {
    licenciasStatusBgClass = 'bg-[#2e3b2b]/5';
    licenciasStatusTextClass = 'text-[#2e3b2b]';
    licenciasStatusBorderClass = 'border-[#2e3b2b]/20';
    licenciasStatusLabel = 'Meta Superada';
  } else if (licenciasAccumulatedRecaudado < licenciasAccumulatedProjected * 0.85) {
    licenciasStatusBgClass = 'bg-red-50/50';
    licenciasStatusTextClass = 'text-red-700';
    licenciasStatusBorderClass = 'border-red-100';
    licenciasStatusLabel = 'Déficit Significativo';
  } else {
    licenciasStatusBgClass = 'bg-[#7c4a36]/5';
    licenciasStatusTextClass = 'text-[#7c4a36]';
    licenciasStatusBorderClass = 'border-[#7c4a36]/20';
    licenciasStatusLabel = 'Bajo la Meta';
  }

  const controls = (
    <div className="flex w-full shrink-0 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto">
      <button
        onClick={() => setActiveChartTab('refrendo')}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold sm:flex-none sm:text-sm outline-none focus:outline-none transition-all ${
          activeChartTab === 'refrendo'
            ? 'bg-white text-brand-dark shadow-sm'
            : 'text-slate-500 hover:text-brand-dark hover:bg-slate-200/50'
        }`}
      >
        Refrendo
      </button>
      <button
        onClick={() => setActiveChartTab('licencias')}
        className={`flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold sm:flex-none sm:text-sm outline-none focus:outline-none transition-all ${
          activeChartTab === 'licencias'
            ? 'bg-white text-brand-dark shadow-sm'
            : 'text-slate-500 hover:text-brand-dark hover:bg-slate-200/50'
        }`}
      >
        Licencias
      </button>
    </div>
  );

  return (
    <ChartContainer
      title="Comparativa de Recaudación"
      description={activeChartTab === 'refrendo' ? "Histórico 2022 - 2026" : "CRI 4.3.4.13 - Licencias de Conducir"}
      icon={<DollarSign className="w-5 h-5 text-brand-dark" />}
      controls={controls}
    >
      {activeChartTab === 'refrendo' ? (
        <>
          <div className="mb-6 flex flex-col gap-6">
            <SeriesSummary 
              data={monthlyRevenueData} 
              keys={['year2026Projected', 'year2026CuentaComprobada', 'year2025', 'year2024', 'year2023', 'year2022']} 
              colors={{
                year2026Projected: COLORS.year2026Projected,
                year2026CuentaComprobada: COLORS.year2026,
                year2025: COLORS.year2025,
                year2024: COLORS.year2024,
                year2023: COLORS.year2023,
                year2022: COLORS.year2022
              }}
              formatMoney
              formatCurrency={formatCurrency}
            />

            {/* Elegant monthly indicator cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-5">
              {/* Card 1: Proyectado al corte */}
              <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between transition-all">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Proyectado al corte (Ene-Jul)
                  </p>
                  <p className="text-base sm:text-lg font-bold text-slate-800 font-mono">
                    {formatCurrency(card1Value)}
                  </p>
                </div>
                <p className="text-[9px] text-slate-400 mt-2">
                  {periodLabel} (Base Ene-Jul: {formatCurrency(fullYearProjectedJanJul)})
                </p>
              </div>

              {/* Card 2: Recaudado */}
              <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between transition-all">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Recaudado (Ene-Jul)
                  </p>
                  <p className="text-base sm:text-lg font-bold text-slate-800 font-mono">
                    {formatCurrency(card2Value)}
                  </p>
                </div>
                <p className="text-[9px] text-slate-400 mt-2">
                  Cifra acumulada de cuenta comprobada
                </p>
              </div>

              {/* Card 3: Diferencia */}
              <div className={`border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300 ${statusBgClass} ${statusBorderClass}`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Diferencia (Meta - Recaudado)
                    </p>
                    <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${statusBgClass} border border-current/10 ${statusTextClass}`}>
                      {statusLabel}
                    </span>
                  </div>
                  <p className={`text-base sm:text-lg font-bold font-mono ${statusTextClass}`}>
                    {card3Formatted}
                  </p>
                </div>
                <p className="text-[9px] text-slate-400 mt-2">
                  {isMetaSuperada 
                    ? 'Superávit registrado en el periodo (+)' 
                    : 'Faltante para cubrir la meta al corte'}
                </p>
              </div>
            </div>
          </div>
          <div className="h-[270px] w-full sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart
                data={monthlyRevenueData}
                margin={{ top: 10, right: 8, left: -8, bottom: 0 }}
                onClick={(state) => {
                  const row = state?.activePayload?.[0]?.payload as { monthName?: string } | undefined;
                  if (row?.monthName) onMonthSelect?.(row.monthName);
                }}
                style={{ cursor: onMonthSelect ? 'pointer' : 'default' }}
              >
                <defs>
                  <linearGradient id="color2022" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.year2022} stopOpacity={0.1}/><stop offset="95%" stopColor={COLORS.year2022} stopOpacity={0}/></linearGradient>
                  <linearGradient id="color2023" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.year2023} stopOpacity={0.15}/><stop offset="95%" stopColor={COLORS.year2023} stopOpacity={0}/></linearGradient>
                  <linearGradient id="color2024" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.year2024} stopOpacity={0.2}/><stop offset="95%" stopColor={COLORS.year2024} stopOpacity={0}/></linearGradient>
                  <linearGradient id="color2025" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.year2025} stopOpacity={0.25}/><stop offset="95%" stopColor={COLORS.year2025} stopOpacity={0}/></linearGradient>
                  <linearGradient id="color2026" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.year2026} stopOpacity={0.4}/><stop offset="95%" stopColor={COLORS.year2026} stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="monthName" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} />
                <Tooltip content={<CustomTooltip chartData={monthlyRevenueData} formatCurrency={formatCurrency} />} />
                <Legend onClick={handleLegendClick} />
                
                <Area type="monotone" dataKey="year2022" name="2022" stroke={COLORS.year2022} fillOpacity={hiddenSeries.includes('year2022') ? 0 : 1} fill="url(#color2022)" strokeWidth={2} strokeDasharray="4 4" strokeOpacity={hiddenSeries.includes('year2022') ? 0 : 0.6} hide={hiddenSeries.includes('year2022')} isAnimationActive={false} />
                <Area type="monotone" dataKey="year2023" name="2023" stroke={COLORS.year2023} fillOpacity={hiddenSeries.includes('year2023') ? 0 : 1} fill="url(#color2023)" strokeWidth={2} strokeOpacity={hiddenSeries.includes('year2023') ? 0 : 0.8} hide={hiddenSeries.includes('year2023')} isAnimationActive={false} />
                <Area type="monotone" dataKey="year2024" name="2024" stroke={COLORS.year2024} fillOpacity={hiddenSeries.includes('year2024') ? 0 : 1} fill="url(#color2024)" strokeWidth={3} hide={hiddenSeries.includes('year2024')} isAnimationActive={false} />
                <Area type="monotone" dataKey="year2025" name="2025" stroke={COLORS.year2025} fillOpacity={hiddenSeries.includes('year2025') ? 0 : 1} fill="url(#color2025)" strokeWidth={3} hide={hiddenSeries.includes('year2025')} isAnimationActive={false} />
                <Area type="monotone" dataKey="year2026Projected" name="2026 Proyectado" stroke={COLORS.year2026Projected} fillOpacity={hiddenSeries.includes('year2026Projected') ? 0 : 0.1} strokeWidth={2} strokeDasharray="5 5" fill="none" dot={false} activeDot={{r: 4}} hide={hiddenSeries.includes('year2026Projected')} isAnimationActive={false} />
                <Area type="monotone" dataKey="year2026CuentaComprobada" name="2026" stroke={COLORS.year2026} fillOpacity={hiddenSeries.includes('year2026CuentaComprobada') ? 0 : 1} fill="url(#color2026)" strokeWidth={4} dot={{ r: 8, fill: COLORS.year2026, stroke: '#fff', strokeWidth: 3 }} isAnimationActive={false} hide={hiddenSeries.includes('year2026CuentaComprobada')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 italic mt-4">
            Fecha de conciliación (cuenta comprobada) con corte al 8 de julio del 2026 (primera semana)
          </p>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-6">
            <SeriesSummary 
              data={LICENCIAS_DATA} 
              keys={['year2026Projected', 'year2026CuentaComprobada']} 
              colors={{
                year2026Projected: '#818cf8',
                year2026CuentaComprobada: '#4f46e5'
              }}
              formatMoney
              formatCurrency={formatCurrency}
            />

            {/* Licencias KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-5">
              {/* Card 1: Proyectado al corte */}
              <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between transition-all">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Proyectado al corte (Ene-Jul)
                  </p>
                  <p className="text-base sm:text-lg font-bold text-slate-800 font-mono">
                    {formatCurrency(licenciasAccumulatedProjected)}
                  </p>
                </div>
                <p className="text-[9px] text-slate-400 mt-2">
                  Proyección al corte (7 Jul) (Base Ene-Jul: {formatCurrency(licenciasFullYearProjectedJanJul)})
                </p>
              </div>

              {/* Card 2: Recaudado */}
              <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-3.5 flex flex-col justify-between transition-all">
                <div>
                  <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Recaudado (Ene-Jul)
                  </p>
                  <p className="text-base sm:text-lg font-bold text-slate-800 font-mono">
                    {formatCurrency(licenciasAccumulatedRecaudado)}
                  </p>
                </div>
                <p className="text-[9px] text-slate-400 mt-2">
                  Cifra acumulada de cuenta comprobada
                </p>
              </div>

              {/* Card 3: Diferencia */}
              <div className={`border rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300 ${licenciasStatusBgClass} ${licenciasStatusBorderClass}`}>
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Diferencia (Meta - Recaudado)
                    </p>
                    <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full ${licenciasStatusBgClass} border border-current/10 ${licenciasStatusTextClass}`}>
                      {licenciasStatusLabel}
                    </span>
                  </div>
                  <p className={`text-base sm:text-lg font-bold font-mono ${licenciasStatusTextClass}`}>
                    {licenciasCard3Formatted}
                  </p>
                </div>
                <p className="text-[9px] text-slate-400 mt-2">
                  {isLicenciasMetaSuperada 
                    ? 'Superávit registrado en el periodo (+)' 
                    : 'Faltante para cubrir la meta al corte'}
                </p>
              </div>
            </div>
          </div>
          <div className="h-[270px] w-full sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart
                data={LICENCIAS_DATA}
                margin={{ top: 10, right: 8, left: -8, bottom: 0 }}
                onClick={(state) => {
                  const row = state?.activePayload?.[0]?.payload as { monthName?: string } | undefined;
                  if (row?.monthName) onMonthSelect?.(row.monthName);
                }}
                style={{ cursor: onMonthSelect ? 'pointer' : 'default' }}
              >
                <defs>
                  <linearGradient id="colorLicenciasRecaudado" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} />
                <XAxis dataKey="monthName" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10, fontWeight: 500 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                <Tooltip content={<CustomTooltip chartData={LICENCIAS_DATA} formatCurrency={formatCurrency} />} />
                <Legend onClick={handleLegendClick} />
                
                <Area 
                  type="monotone" 
                  dataKey="year2026Projected" 
                  name="2026 Proyectado" 
                  stroke="#818cf8" 
                  fill="none" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false}
                  activeDot={{r: 4}}
                  hide={hiddenSeries.includes('year2026Projected')} isAnimationActive={false}
                />
                <Area 
                  type="monotone" 
                  dataKey="year2026CuentaComprobada" 
                  name="2026" 
                  stroke="#4f46e5" 
                  fillOpacity={hiddenSeries.includes('year2026CuentaComprobada') ? 0 : 1} 
                  fill="url(#colorLicenciasRecaudado)" 
                  strokeWidth={4} 
                  dot={{ r: 8, fill: '#4f46e5', stroke: '#fff', strokeWidth: 3 }} isAnimationActive={false}
                  hide={hiddenSeries.includes('year2026CuentaComprobada')}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-slate-400 italic mt-4">
            Datos consolidados según el catálogo de rubros de ingresos (CRI) del estado de Morelos con corte al 8 de julio del 2026 (primera semana)
          </p>
        </>
      )}
    </ChartContainer>
  );
};
