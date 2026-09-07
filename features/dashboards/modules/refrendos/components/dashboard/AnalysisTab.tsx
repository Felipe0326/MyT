import React, { useState } from 'react';
import { DiagnosticoEjecutivo } from './DiagnosticoEjecutivo';
import { HojaDeRuta } from './HojaDeRuta';

export const AnalysisTab: React.FC = () => {
  const [view, setView] = useState<'diagnostico' | 'ruta'>('diagnostico');

  return (
    <div className="w-full bg-[#fcfcfc] min-h-screen">
      <div className="mx-auto max-w-5xl px-3 py-5 sm:px-6 sm:py-8">
        
        {/* Sub-tabs for Analysis */}
        <div className="scrollbar-hide mb-6 flex w-full gap-1 overflow-x-auto rounded-xl border border-slate-200/60 bg-slate-100/50 p-1 sm:mb-8 sm:w-fit">
          <button
            onClick={() => setView('diagnostico')}
            className={`min-h-10 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              view === 'diagnostico' 
                ? 'bg-white text-brand-dark shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-brand-dark hover:bg-slate-50'
            }`}
          >
            Diagnóstico Ejecutivo
          </button>
          <button
            onClick={() => setView('ruta')}
            className={`min-h-10 shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              view === 'ruta' 
                ? 'bg-white text-brand-dark shadow-sm border border-slate-200/50' 
                : 'text-slate-500 hover:text-brand-dark hover:bg-slate-50'
            }`}
          >
            Hoja de Ruta
          </button>
        </div>

        {view === 'ruta' && <HojaDeRuta />}
        {view === 'diagnostico' && <DiagnosticoEjecutivo />}
      </div>
    </div>
  );
};
