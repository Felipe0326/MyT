"use client";

import { ChevronDown, ChevronUp, Download, Loader2 } from "lucide-react";

export function RecordsSectionHeader({
  title,
  eyebrow,
  pageSize,
  total,
  visible,
  controlsId,
  exporting,
  onToggle,
  onExport,
}: {
  title: string;
  eyebrow?: string;
  pageSize: number;
  total: number;
  visible: boolean;
  controlsId: string;
  exporting: boolean;
  onToggle: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch justify-between gap-4 border-b border-slate-100 px-4 py-5 sm:px-6 xl:flex-row xl:items-center">
      <div className="min-w-0">
        {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#74785C]">{eyebrow}</p>}
        <h3 className={`${eyebrow ? "mt-1" : ""} text-lg font-bold text-[#2E332A]`}>{title}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {pageSize} registros por página · {total.toLocaleString("es-MX")} resultados
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-2 min-[520px]:grid-cols-[auto_minmax(0,1fr)_auto] xl:w-auto xl:min-w-[520px] xl:items-center">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={visible}
          aria-controls={controlsId}
          className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#526647] transition-colors hover:bg-[#f7f8f4]"
        >
          {visible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {visible ? "Ocultar tabla" : "Mostrar tabla"}
        </button>
        <button
          type="button"
          disabled={exporting || total === 0}
          onClick={onExport}
          className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#eef1ea] px-4 py-2 text-xs font-bold text-[#526647] transition-colors hover:bg-[#e2e7dc] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar registros
        </button>
        <span className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl bg-slate-100 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-600">
          {total.toLocaleString("es-MX")} registros
        </span>
      </div>
    </div>
  );
}
