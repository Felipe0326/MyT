"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Download, Loader2, type LucideIcon } from "lucide-react";
import { SmoothFilterSelect } from "@/components/ui/SmoothFilterSelect";
import type { LicenciaRecord, LicenciasResponse, LicenciasSortKey, LicenseYear, Modalidad, SortDirection } from "@/features/licencias/types";

export function DateField({ label, year, value, onChange }: { label: string; year: LicenseYear; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#74785C]">
        <CalendarDays className="h-3.5 w-3.5" /> {label}
      </span>
      <input type="date" min={`${year}-01-01`} max={`${year}-12-31`} value={value} onChange={(event) => onChange(event.target.value)} className="h-12 w-full rounded-xl border border-[#dedccf] bg-[#faf9f5] px-4 text-sm text-[#2E332A] outline-none focus:border-[#74785C] focus:ring-4 focus:ring-[#74785C]/10" />
    </label>
  );
}

export function SelectField({ label, value, onChange, options, placeholder }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ id: number; nombre: string }>; placeholder: string }) {
  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-black uppercase tracking-widest text-[#74785C]">{label}</span>
      <SmoothFilterSelect
        value={value}
        onChange={onChange}
        options={options.map((option) => ({ value: String(option.id), label: option.nombre }))}
        placeholder={placeholder}
        ariaLabel={label}
        searchPlaceholder={`Buscar ${label.toLocaleLowerCase("es-MX")}...`}
        searchable
      />
    </div>
  );
}

export function ModeFilter({ value, onChange }: { value: Modalidad; onChange: (value: Modalidad) => void }) {
  return (
    <div className="space-y-2">
      <span className="block text-[10px] font-black uppercase tracking-widest text-[#74785C]">Modalidad del trámite</span>
      <SmoothFilterSelect
        value={value}
        onChange={(nextValue) => onChange(nextValue as Modalidad)}
        options={[
          { value: "en_linea", label: "En línea" },
          { value: "presencial", label: "Presencial" },
        ]}
        placeholder="Todas las modalidades"
        ariaLabel="Modalidad del trámite"
      />
    </div>
  );
}

export function LicenseMetricCard({ title, value, detail, icon: Icon, accent }: { title: string; value: number; detail: string; icon: LucideIcon; accent: string }) {
  return (
    <article className="relative overflow-hidden rounded-[24px] border border-[#dedccf] bg-white p-5 shadow-[0_10px_28px_rgba(46,51,42,0.07)] sm:p-6">
      <div className={`absolute inset-x-0 top-0 h-1.5 ${accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{title}</p>
          <strong className="mt-3 block text-3xl font-bold tracking-tight text-[#2E332A]">{value.toLocaleString("es-MX")}</strong>
          <span className="mt-2 block text-xs font-semibold text-[#74785C]">{detail}</span>
        </div>
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent} text-white shadow-sm`}><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

export function LicenciasRecordsTable({ records, pagination, modalidad, sortKey, sortDirection, exporting, onSort, onPageChange, onExport, onSelect }: {
  records: LicenciaRecord[];
  pagination: LicenciasResponse["pagination"];
  modalidad: Modalidad;
  sortKey: LicenciasSortKey;
  sortDirection: SortDirection;
  exporting: boolean;
  onSort: (key: LicenciasSortKey) => void;
  onPageChange: (page: number) => void;
  onExport: () => void;
  onSelect: (record: LicenciaRecord) => void;
}) {
  const [visible, setVisible] = useState(true);
  const showOnline = modalidad !== "presencial";
  const showPresencial = modalidad !== "en_linea";
  const columnCount = 5 + Number(showOnline) + Number(showPresencial);

  return (
    <section className="min-w-0 overflow-hidden rounded-[26px] border border-[#dedccf] bg-white shadow-[0_10px_30px_rgba(46,51,42,0.07)]">
      <div className="flex flex-col gap-4 border-b border-[#e8e5dc] px-4 py-5 sm:px-6 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#74785C]">Detalle operativo</p>
          <h3 className="mt-1 text-lg font-bold text-[#2E332A]">Registros diarios de Licencias</h3>
          <p className="mt-1 text-xs text-slate-500">50 registros por página · {pagination.total.toLocaleString("es-MX")} resultados</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button type="button" onClick={() => setVisible((current) => !current)} aria-expanded={visible} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#dedccf] bg-white px-4 text-xs font-bold text-[#526647] hover:bg-[#F5F4F0]">
            {visible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {visible ? "Ocultar tabla" : "Mostrar tabla"}
          </button>
          <button type="button" onClick={onExport} disabled={exporting || pagination.total === 0} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#74785C] px-4 text-xs font-bold text-white hover:bg-[#62664d] disabled:opacity-50">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar filtrados
          </button>
        </div>
      </div>

      {visible && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1120px] border-collapse text-left">
              <thead className="bg-[#74785C] text-white">
                <tr>
                  <SortHeader label="Fecha" column="date" active={sortKey} direction={sortDirection} onSort={onSort} />
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/75">Día</th>
                  <SortHeader label="Tipo de trámite" column="tipo_tramite" active={sortKey} direction={sortDirection} onSort={onSort} />
                  <SortHeader label="Tipo de licencia" column="tipo_licencia" active={sortKey} direction={sortDirection} onSort={onSort} />
                  {showPresencial && <SortHeader label="Presenciales" column="presencial" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />}
                  {showOnline && <SortHeader label="En línea" column="en_linea" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />}
                  <SortHeader label="Total" column="total" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf0f5]">
                {records.map((record) => (
                  <tr key={record.id} onClick={() => onSelect(record)} className="cursor-pointer transition hover:bg-[#F5F4F0]">
                    <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-[#2E332A]">{formatDate(record.fecha)}</td>
                    <td className="px-5 py-4 text-sm text-slate-500">{record.dia_semana}</td>
                    <td className="max-w-[260px] px-5 py-4 text-sm text-[#2E332A]"><span className="block truncate" title={record.tipo_tramite}>{record.tipo_tramite}</span></td>
                    <td className="max-w-[260px] px-5 py-4 text-sm text-[#2E332A]"><span className="block truncate" title={record.tipo_licencia}>{record.tipo_licencia}</span></td>
                    {showPresencial && <td className="px-5 py-4 text-right text-sm font-semibold text-[#765c47]">{record.tramites_presenciales.toLocaleString("es-MX")}</td>}
                    {showOnline && <td className="px-5 py-4 text-right text-sm font-semibold text-[#526647]">{record.tramites_en_linea.toLocaleString("es-MX")}</td>}
                    <td className="px-5 py-4 text-right text-sm font-bold text-[#2E332A]">{record.total_tramites.toLocaleString("es-MX")}</td>
                  </tr>
                ))}
                {records.length === 0 && <tr><td colSpan={columnCount} className="px-5 py-14 text-center text-sm text-slate-500">No hay registros para los filtros seleccionados.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[#e8e5dc] bg-[#faf9f5] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span className="text-xs font-semibold text-slate-500">Página {pagination.page} de {Math.max(1, pagination.totalPages)}</span>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" disabled={!pagination.hasPrevious} onClick={() => onPageChange(Math.max(1, pagination.page - 1))} className="min-h-11 rounded-xl border border-[#dedccf] bg-white px-5 text-xs font-bold text-[#526647] disabled:cursor-not-allowed disabled:opacity-40">Anterior</button>
              <button type="button" disabled={!pagination.hasNext} onClick={() => onPageChange(pagination.page + 1)} className="min-h-11 rounded-xl bg-[#74785C] px-5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SortHeader({ label, column, active, direction, onSort, align = "left" }: { label: string; column: LicenciasSortKey; active: LicenciasSortKey; direction: SortDirection; onSort: (key: LicenciasSortKey) => void; align?: "left" | "right" }) {
  const selected = active === column;
  return (
    <th className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-wider ${align === "right" ? "text-right" : ""}`}>
      <button type="button" onClick={() => onSort(column)} className={`inline-flex min-h-10 items-center gap-1.5 ${align === "right" ? "ml-auto" : ""}`}>
        <span className={selected && direction === "asc" ? "text-[#f0ddad]" : "text-white/35"}>↑</span>
        <span>{label}</span>
        <span className={selected && direction === "desc" ? "text-[#f0ddad]" : "text-white/35"}>↓</span>
      </button>
    </th>
  );
}
function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
