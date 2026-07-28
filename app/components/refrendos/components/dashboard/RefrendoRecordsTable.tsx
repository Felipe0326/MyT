import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react';
import type {
  RefrendoRecord,
  RefrendoSortKey,
  SortDirection,
} from '../../services/dataService';

type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export function RefrendoRecordsTable({
  records,
  pagination,
  sortKey,
  sortDirection,
  onSort,
  onPageChange,
  onExport,
  exporting,
  onRowSelect,
}: {
  records: RefrendoRecord[];
  pagination: Pagination;
  sortKey: RefrendoSortKey;
  sortDirection: SortDirection;
  onSort: (key: RefrendoSortKey) => void;
  onPageChange: (page: number) => void;
  onExport: () => void;
  exporting: boolean;
  onRowSelect?: (record: RefrendoRecord) => void;
}) {
  const [recordsVisible, setRecordsVisible] = useState(true);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col items-stretch justify-between gap-4 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-slate-800">Registros de refrendo</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            La tabla conserva todos los registros que cumplen los filtros. Se muestran {pagination.pageSize} por página.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <button
            type="button"
            onClick={() => setRecordsVisible((current) => !current)}
            aria-expanded={recordsVisible}
            aria-controls="refrendo-records-content"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#526647] hover:bg-[#f7f8f4] sm:w-auto"
          >
            {recordsVisible ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {recordsVisible ? 'Ocultar tabla' : 'Mostrar tabla'}
          </button>
          <button
            type="button"
            disabled={exporting || pagination.total === 0}
            onClick={onExport}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[#eef1ea] px-4 py-2 text-xs font-bold text-[#526647] transition hover:bg-[#e2e7dc] disabled:opacity-50 sm:w-auto"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Exportar todos los filtrados
          </button>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-center text-[10px] font-black uppercase tracking-wider text-slate-600">
            {pagination.total.toLocaleString('es-MX')} registros
          </span>
        </div>
      </div>

      {recordsVisible && (
        <div id="refrendo-records-content">
          <div className="divide-y divide-slate-100 md:hidden">
        {records.map((record) => (
          <button
            key={record.id}
            type="button"
            onClick={() => onRowSelect?.(record)}
            className="mobile-data-card"
            title={onRowSelect ? 'Seleccionar este registro como filtro' : undefined}
          >
            <div className="mobile-data-card__top">
              <div className="min-w-0">
                <strong className="block text-sm text-slate-800">{formatDate(record.fecha)}</strong>
                <span className="mt-1 block text-[10px] font-bold uppercase text-slate-400">{record.dia_semana || '—'}</span>
              </div>
              <span className="shrink-0 rounded-full bg-[#eef1ea] px-3 py-1.5 text-xs font-bold text-[#526647]">
                {record.hora == null ? 'Sin hora' : `${String(record.hora).padStart(2, '0')}:00`}
              </span>
            </div>

            <p className="m-0 break-words text-sm font-semibold leading-relaxed text-slate-700">
              {record.movimiento || 'Sin movimiento'}
            </p>

            <div className="mobile-data-card__metrics">
              <div className="mobile-data-card__metric">
                <small>Total</small>
                <strong>{Number(record.total_registros).toLocaleString('es-MX')}</strong>
              </div>
              <div className="mobile-data-card__metric">
                <small>Digital</small>
                <strong className="text-[#526647]">{Number(record.es_digital).toLocaleString('es-MX')}</strong>
              </div>
              <div className="mobile-data-card__metric">
                <small>Presencial</small>
                <strong className="text-[#8b6f46]">{Number(record.es_tradicional).toLocaleString('es-MX')}</strong>
              </div>
            </div>
          </button>
        ))}
        {records.length === 0 && (
          <div className="px-5 py-12 text-center text-sm text-slate-500">
            No hay registros para los filtros seleccionados.
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1050px] border-collapse text-left">
          <thead>
            <tr className="bg-[#eeede4]">
              <SortHeader label="Fecha" column="date" active={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Movimiento" column="movimiento" active={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Hora" column="hora" active={sortKey} direction={sortDirection} onSort={onSort} />
              <SortHeader label="Total registros" column="total" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />
              <SortHeader label="Digital" column="digital" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />
              <SortHeader label="Tradicional" column="tradicional" active={sortKey} direction={sortDirection} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {records.map((record) => (
              <tr
                key={record.id}
                onClick={() => onRowSelect?.(record)}
                className={`transition-colors hover:bg-[#f3f5ef] ${onRowSelect ? 'cursor-pointer' : ''}`}
                title={onRowSelect ? 'Seleccionar este registro como filtro' : undefined}
              >
                <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-slate-700">
                  {formatDate(record.fecha)}
                  <span className="mt-1 block text-[10px] font-bold uppercase text-slate-400">{record.dia_semana || '—'}</span>
                </td>
                <td className="max-w-[360px] px-5 py-4 text-sm text-slate-700">
                  <span className="block truncate" title={record.movimiento || ''}>{record.movimiento || 'Sin movimiento'}</span>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                  {record.hora == null ? 'Sin hora' : `${String(record.hora).padStart(2, '0')}:00`}
                </td>
                <td className="px-5 py-4 text-right text-sm font-bold text-slate-800">{Number(record.total_registros).toLocaleString('es-MX')}</td>
                <td className="px-5 py-4 text-right text-sm font-semibold text-[#526647]">{Number(record.es_digital).toLocaleString('es-MX')}</td>
                <td className="px-5 py-4 text-right text-sm font-semibold text-[#8b6f46]">{Number(record.es_tradicional).toLocaleString('es-MX')}</td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                  No hay registros para los filtros seleccionados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-slate-100 bg-[#faf9f5] px-4 py-4 sm:flex-row sm:items-center sm:px-5">
            <span className="text-xs font-semibold text-slate-500">
              Página {pagination.page} de {Math.max(pagination.totalPages, 1)}
            </span>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button
                type="button"
                disabled={!pagination.hasPrevious}
                onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
                className="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#526647] disabled:opacity-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!pagination.hasNext}
                onClick={() => onPageChange(pagination.page + 1)}
                className="min-h-11 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-[#526647] disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SortHeader({
  label,
  column,
  active,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  column: RefrendoSortKey;
  active: RefrendoSortKey;
  direction: SortDirection;
  onSort: (key: RefrendoSortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = active === column;
  return (
    <th className={`border-b border-[#dedccf] px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-600 ${align === 'right' ? 'text-right' : ''}`}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex min-h-10 items-center gap-1.5 ${align === 'right' ? 'ml-auto' : ''}`}
      >
        <span className={isActive && direction === 'asc' ? 'text-[#526647]' : 'text-slate-400'} aria-hidden="true">↑</span>
        <span>{label}</span>
        <span className={isActive && direction === 'desc' ? 'text-[#526647]' : 'text-slate-400'} aria-hidden="true">↓</span>
      </button>
    </th>
  );
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
