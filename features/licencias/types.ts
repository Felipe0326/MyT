export type MonthKey = "jan" | "feb" | "mar" | "abr" | "may" | "jun" | "jul" | "aug" | "sep" | "oct" | "nov" | "dec";
export type LicenseYear = 2025 | 2026;
export type Modalidad = "" | "en_linea" | "presencial";
export type LicenciasSortKey = "date" | "tipo_tramite" | "tipo_licencia" | "presencial" | "en_linea" | "total";
export type SortDirection = "asc" | "desc";

export type LicenciaRecord = {
  id: number;
  fecha: string;
  anio: number;
  mes: string;
  dia_semana: string;
  tipo_tramite_id: number;
  tipo_tramite: string;
  tipo_licencia_id: number;
  tipo_licencia: string;
  tramites_presenciales: number;
  tramites_en_linea: number;
  total_tramites: number;
  actualizado_en: string;
};

export type LicenciasResponse = {
  metrics: {
    tramites_presenciales: number;
    tramites_en_linea: number;
    total_tramites: number;
  };
  dailyTrend: LicenciaRecord[];
  records: LicenciaRecord[];
  filters: {
    tiposTramite: Array<{ id: number; nombre: string }>;
    tiposLicencia: Array<{ id: number; nombre: string }>;
  };
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
  actualizado_en: string | null;
};
