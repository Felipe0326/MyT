"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { SmoothFilterSelect } from "@/components/ui/SmoothFilterSelect";
import type { NpsSortDirection, NpsSortKey } from "@/features/nps/types";

type SortDirection = NpsSortDirection;

export function SearchableFilterSelect({
  label,
  icon,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#566151]">{icon}{label}</label>
      <SmoothFilterSelect
        value={value}
        onChange={onChange}
        options={options.map((option) => ({ value: option, label: option }))}
        placeholder={allLabel}
        ariaLabel={label}
        searchable
      />
    </div>
  );
}

export function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#f1f3ed] px-3 py-1.5 font-semibold text-[#526647]">
      <span className="max-w-[280px] truncate">{label}</span>
      <button type="button" onClick={onRemove} aria-label={`Quitar filtro ${label}`} className="rounded-full hover:bg-white/80">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export function MetricCard({ title, value, unit, note, icon, accent }: { title: string; value: string | number; unit: string; note: string; icon: ReactNode; accent: string }) {
  return (
    <article className="group relative min-h-[165px] overflow-hidden rounded-2xl border border-[#e5e1d6] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md sm:min-h-[185px] sm:rounded-[26px] sm:p-6">
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: accent }} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-[0.16em] text-[#566151]">{title}</h3>
          <div className="mt-6 flex items-baseline gap-1">
            <strong className="text-4xl leading-none text-[#172117] sm:text-5xl">{value}</strong>
            <span className="text-xs font-bold text-[#899087]">{unit}</span>
          </div>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#f2f3ee] text-[#526647] [&>svg]:h-5 [&>svg]:w-5">{icon}</div>
      </div>
      <div className="mt-7 flex items-center gap-2 text-xs font-semibold text-[#687166]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />{note}</div>
    </article>
  );
}

export function SortHeader({ label, column, active, direction, onSort, align = "left" }: { label: string; column: NpsSortKey; active: NpsSortKey; direction: SortDirection; onSort: (key: NpsSortKey) => void; align?: "left" | "right" }) {
  const isActive = active === column;
  return (
    <th className={`px-6 py-4 text-[11px] font-bold text-[#4e584c] ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={() => onSort(column)} className={`inline-flex items-center gap-1.5 ${align === "right" ? "ml-auto" : ""}`}>
        <span className={isActive && direction === "asc" ? "text-[#526647]" : "text-[#939a91]"}>↑</span>
        <span>{label}</span>
        <span className={isActive && direction === "desc" ? "text-[#526647]" : "text-[#939a91]"}>↓</span>
      </button>
    </th>
  );
}

export function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-[#596158]"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>
      <strong className="text-[#1f2d1f]">{value.toLocaleString("es-MX")}</strong>
    </div>
  );
}

export function NpsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { total: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-[#dedbd1] bg-white px-4 py-3 shadow-xl">
      <p className="text-xs font-bold text-[#1f2d1f]">{label}</p>
      <p className="mt-1 text-sm text-[#526647]">NPS: <strong>{payload[0].value}</strong></p>
      <p className="text-xs text-[#7a8176]">Encuestas: {payload[0].payload.total.toLocaleString("es-MX")}</p>
    </div>
  );
}
