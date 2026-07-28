import React, { useMemo, useState } from 'react';
import { SectionTag, KPI, Callout, Note } from './AnalysisUI';

type FunnelSortKey = 'name' | 'id' | 'c' | 'r';
type SortDirection = 'asc' | 'desc';

export const DiagnosticoEjecutivo: React.FC = () => {
  const funnelRows = [
    { id: 0, name: 'Sin identificación del vehículo', c: 28169, r: 22.93, t: 'Paso 0' },
    { id: 2, name: 'Validación de vehículo', c: 6468, r: 5.26, t: 'Paso 1' },
    { id: 5, name: 'Verif. vigencia de seguro', c: 20207, r: 16.45, t: 'Paso 2' },
    { id: 6, name: 'Confirmación de datos', c: 2584, r: 2.10, t: 'Paso 3' },
    { id: 7, name: 'Documentos del propietario', c: 19546, r: 15.91, t: 'Paso 4' },
    { id: 8, name: 'Verificación de documentos', c: 14910, r: 12.14, t: 'Paso 5' },
    { id: 9, name: 'Pago', c: 22693, r: 21.15, t: 'Paso 6' },
  ];
  const [funnelSortKey, setFunnelSortKey] = useState<FunnelSortKey>('id');
  const [funnelSortDirection, setFunnelSortDirection] = useState<SortDirection>('asc');

  const sortedFunnelRows = useMemo(() => {
    const multiplier = funnelSortDirection === 'asc' ? 1 : -1;
    return [...funnelRows].sort((a, b) => {
      if (funnelSortKey === 'name') {
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true }) * multiplier;
      }
      return (a[funnelSortKey] - b[funnelSortKey]) * multiplier;
    });
  }, [funnelSortKey, funnelSortDirection]);

  const toggleFunnelSort = (key: FunnelSortKey) => {
    if (funnelSortKey === key) {
      setFunnelSortDirection(direction => direction === 'asc' ? 'desc' : 'asc');
    } else {
      setFunnelSortKey(key);
      setFunnelSortDirection('asc');
    }
  };

  return (
    <div className="w-full">
      {/* Cover Section */}
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-emerald-800 bg-emerald-900 p-5 text-stone-50 shadow-sm sm:mb-12 sm:p-9 lg:p-12">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'repeating-linear-gradient(45deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(-45deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)'
        }} />
        <div className="relative z-10">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-emerald-200/70 mb-6">Diagnóstico ejecutivo · Morelos 2026</div>
          <h1 className="mb-6 max-w-3xl font-sans text-4xl font-bold leading-[0.95] tracking-tight sm:mb-8 sm:text-6xl md:text-7xl">
            Refrendo<br/>Digital<br/><em className="text-emerald-400 not-italic">Morelos</em>
          </h1>
          <p className="text-sm text-emerald-100 max-w-md leading-relaxed">
            Análisis de 729,000 trámites: lo que se recaudó, quién se quedó en el camino y cuánto universo queda por alcanzar.
          </p>
          
          <div className="mt-7 flex flex-wrap gap-2 pt-6 border-t border-emerald-800 sm:mt-10 sm:gap-2.5 sm:pt-8">
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase px-3.5 py-1.5 border border-emerald-500/50 bg-emerald-500/20 text-emerald-200 rounded-md">$195.7M recaudados</div>
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase px-3.5 py-1.5 border border-emerald-500/50 bg-emerald-500/20 text-emerald-200 rounded-md">211,339 autos pagaron</div>
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase px-3.5 py-1.5 border border-emerald-700/50 text-emerald-200/70 rounded-md">165,924 autos perdidos</div>
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase px-3.5 py-1.5 border border-emerald-700/50 text-emerald-200/70 rounded-md">$139.9M potencial</div>
            <div className="font-mono text-[10px] tracking-[0.12em] uppercase px-3.5 py-1.5 border border-emerald-700/50 text-emerald-200/70 rounded-md">mayo 2026</div>
          </div>
        </div>
      </div>

      <section className="mb-16">
        <SectionTag color="emerald">Eficiencia del sistema</SectionTag>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-800 mb-4">7 de cada 10 autos que entraron al sistema pagaron su refrendo</h2>
        <p className="text-sm text-stone-600 max-w-2xl leading-relaxed mb-8">La unidad de análisis es el auto único, identificado por su placa. Los registros sin placa corresponden a trámites que no avanzaron del primer paso — nunca llegaron a identificar el vehículo.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-stone-200 border border-stone-200 rounded-xl overflow-hidden">
          <KPI label="Autos en sistema (con placa)" value="302,842" sub="identificados por <code>attr_vehicle_plate</code>" />
          <KPI label="Conversión: pagaron" value="69.8%" sub="211,339 autos pagaron sobre 302,842 con placa registrada" color="g" />
          <KPI label="Sin placa (paso inicial)" value="34,997" sub="no alcanzaron a registrar su placa" color="y" />
          <KPI label="Con placa, nunca pagaron" value="169,818" sub="llegaron a identificar su auto pero no completaron el pago" color="r" />
        </div>
        <Note title="Por qué se usa la placa como unidad:">Un mismo ciudadano puede tener múltiples vehículos o múltiples intentos. Usar <code>attr_vehicle_plate</code> como identificador único elimina la duplicidad por reintentos y refleja directamente cuántos autos efectivamente obtuvieron su refrendo digital. Los 34,997 registros sin placa se ubican en el paso inicial del funnel — son trámites abandonados antes de siquiera consultar el vehículo.</Note>
      </section>

      <section className="mb-16">
        <SectionTag color="red">Oportunidad de recaudación</SectionTag>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-800 mb-4">$139.9M en autos que iniciaron el trámite y no pagaron</h2>
        <p className="text-sm text-stone-600 max-w-2xl leading-relaxed mb-8">Un "auto perdido" es un vehículo cuyo trámite nunca generó un pago y lleva más de 30 días sin actividad. Se separan en dos grupos: los que al menos llegaron a identificar su auto (con placa) y los que abandonaron en el primer paso.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-stone-200 border border-stone-200 rounded-xl overflow-hidden">
          <KPI label="Autos perdidos con placa (≥30 días)" value="137,755" sub="llegaron a identificar su vehículo pero no pagaron" color="r" />
          <KPI label="Sin placa, >30 días inactivos" value="28,169" sub="abandonaron en el primer paso antes de identificar su auto" color="r" />
          <KPI label="Recaudación potencial total" value="$139.9M" sub="cota superior · recuperación realista 20–30%: entre <strong>$28M y $42M</strong>" color="r" />
        </div>
        
        <Callout subtitle="El escenario del 100% es teórico. El rango 20–30% refleja tasas de reenganche típicas en servicios digitales de gobierno.">
          Si se hubiese capturado el 100% de estos autos, la recaudación habría crecido <em className="font-semibold not-italic text-emerald-700">+71.5%</em> — de $195.7M a $335.6M. Con una campaña realista de reactivación del 20–30%, el potencial incremental es entre <em className="font-semibold not-italic text-emerald-700">$28M y $42M adicionales.</em>
        </Callout>

        <Note title="⚠ Cota superior, no garantizada:">Algunos autos pudieron haber refrendado en ventanilla física, tener datos desactualizados en el padrón, o el propietario haber decidido no renovar. El porcentaje real recuperable con intervención digital se estima en 20–30%, dando entre $28M y $42M de recaudación adicional potencial.</Note>
      </section>

      <section className="mb-16">
        <SectionTag color="red">Dónde se pierden</SectionTag>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-800 mb-4">El paso más avanzado que alcanzaron los 137,755 autos perdidos</h2>
        <p className="text-sm text-stone-600 max-w-2xl leading-relaxed mb-8">Para cada placa única se tomó el paso más avanzado alcanzado en cualquier intento. Los 28,169 registros sin placa se agregan al inicio como "Paso inicial — sin identificación del vehículo".</p>

        <div className="overflow-x-auto rounded-xl border border-stone-200">
          <table className="w-full min-w-[720px] text-left text-sm text-stone-600">
            <thead className="bg-stone-50 text-[10px] tracking-wider uppercase text-stone-500 font-mono">
              <tr>
                <FunnelSortHeader label="Paso" column="name" active={funnelSortKey} direction={funnelSortDirection} onSort={toggleFunnelSort} />
                <FunnelSortHeader label="Step" column="id" active={funnelSortKey} direction={funnelSortDirection} onSort={toggleFunnelSort} align="right" />
                <FunnelSortHeader label="Autos perdidos" column="c" active={funnelSortKey} direction={funnelSortDirection} onSort={toggleFunnelSort} align="right" />
                <FunnelSortHeader label="Potencial perdido" column="r" active={funnelSortKey} direction={funnelSortDirection} onSort={toggleFunnelSort} align="right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 bg-white">
              {sortedFunnelRows.map((row) => (
                <tr key={row.id} className={row.id === 0 ? 'bg-rose-50/50' : undefined}>
                  <td className="px-4 py-3 font-medium text-stone-800">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase ${row.id === 0 ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-stone-200 bg-stone-100 text-stone-600'}`}>{row.t}</span>
                      {row.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-stone-400">{row.id === 0 ? '—' : `Step ${row.id}`}</td>
                  <td className="px-4 py-3 text-right">{row.c.toLocaleString()}</td>
                  <td className={`px-4 py-3 text-right font-medium ${row.id === 0 ? 'text-rose-600' : ''}`}>${row.r.toFixed(2)}M</td>
                </tr>
              ))}
              <tr>
                <td className="px-4 py-3 text-xs text-stone-400 italic" colSpan={4}>* Mostrando los principales pasos del flujo estándar. Hay pasos adicionales no mostrados en esta tabla.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-16">
        <SectionTag color="emerald">Universo por alcanzar</SectionTag>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-800 mb-4">El sistema ha llegado al 25.7% del parque vehicular de Morelos</h2>
        <p className="text-sm text-stone-600 max-w-2xl leading-relaxed mb-8">Con datos del INEGI 2024, uno de cada cuatro autos registrados en el estado ya pagó su refrendo digitalmente. La cifra excluye los que ingresaron al sistema pero no pagaron.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-[1px] bg-stone-200 border border-stone-200 rounded-xl overflow-hidden mb-8">
          <KPI label="Placas que pagaron digitalmente" value="211,339" sub="autos con pago completado · <code>completed_payments_count &gt; 0</code>" color="g" />
          <KPI label="Placas en sistema (total)" value="302,842" sub="autos que llegaron a identificarse · + 34,997 sin placa (paso inicial)" />
          <KPI label="Autos particulares Morelos ⚠" value="~820K" sub="estimado INEGI 2024 · incluye placas de residentes CDMX" color="r" />
        </div>

        <div className="my-8">
          <div className="font-mono text-[10px] tracking-wider uppercase text-stone-500 mb-3">Distribución del parque vehicular particular estimado (~820K)</div>
          <div className="h-8 bg-stone-100 rounded-lg overflow-hidden flex w-full ring-1 ring-stone-200">
            <div style={{ width: '25.7%' }} className="h-full bg-emerald-600"></div>
            <div style={{ width: '11.2%' }} className="h-full bg-emerald-800"></div>
            <div style={{ width: '63.1%' }} className="h-full bg-stone-200"></div>
          </div>
          <div className="flex flex-wrap gap-4 mt-4">
            <div className="flex items-center gap-2 text-xs text-stone-600"><div className="w-3 h-3 rounded bg-emerald-600"></div>Pagaron refrendo digital (25.7% · 211K)</div>
            <div className="flex items-center gap-2 text-xs text-stone-600"><div className="w-3 h-3 rounded bg-emerald-800"></div>En sistema, no pagaron (11.2% · 92K)</div>
            <div className="flex items-center gap-2 text-xs text-stone-600"><div className="w-3 h-3 rounded bg-stone-200 border border-stone-300"></div>Sin contacto con el sistema digital (63.1% · ~517K)</div>
          </div>
        </div>

        <Callout subtitle="La barrera no es técnica — es de conocimiento y confianza ciudadana.">
          Si solo el 10% del universo sin contacto digital migra al canal: <em className="font-semibold not-italic text-emerald-700">~52,000 autos adicionales × $814 = $42.3M de recaudación digital nueva.</em>
        </Callout>
      </section>

      <section className="mb-8">
        <SectionTag color="grn">Comunicación ciudadana</SectionTag>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-800 mb-4">Lo que el sistema puede comunicar hacia afuera</h2>
        <p className="text-sm text-stone-600 max-w-2xl leading-relaxed mb-8">Estos números son verificables, positivos y comunicables. Sirven de base para una campaña que amplíe el universo digital.</p>
        
        <Callout subtitle="Titular para comunicación masiva · usar 'menos de 15 minutos' en versión conservadora">
          "211,000 autos en Morelos ya tienen su refrendo digital — la mitad lo tramitó en <em className="font-semibold not-italic text-emerald-700">menos de 10 minutos</em>, sin filas, sin gasolina, sin tiempo perdido."
        </Callout>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] bg-stone-200 border border-stone-200 rounded-xl overflow-hidden mt-8">
          <KPI label="Duración mediana" value="7 min" sub="la mitad de los trámites tardó 7 min o menos" color="g" />
          <KPI label="Terminaron en <15 min" value="75%" sub="3 de cada 4 usuarios completaron rápido" color="g" />
          <KPI label="Primer intento exitoso" value="70,606" sub="ciudadanos que completaron a la primera" color="g" />
          <KPI label="Disponible 24 horas" value="2,134" sub="trámites completados entre medianoche y 1am" color="g" />
        </div>
      </section>
    </div>
  );
};


function FunnelSortHeader({
  label,
  column,
  active,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  column: FunnelSortKey;
  active: FunnelSortKey;
  direction: SortDirection;
  onSort: (key: FunnelSortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = active === column;
  return (
    <th className={`px-4 py-3 border-b border-stone-200 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1.5 ${align === 'right' ? 'ml-auto' : ''}`}
      >
        <span className={isActive && direction === 'asc' ? 'text-emerald-700' : 'text-stone-400'} aria-hidden="true">↑</span>
        <span>{label}</span>
        <span className={isActive && direction === 'desc' ? 'text-emerald-700' : 'text-stone-400'} aria-hidden="true">↓</span>
      </button>
    </th>
  );
}
