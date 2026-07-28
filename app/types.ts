import type { AppRole, AppSection } from "../lib/session";

export type SessionData = {
  authenticated: true;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: AppRole;
    status: "activo" | "inactivo";
  };
  sections: AppSection[];
  csrfToken: string;
  idleTimeoutMinutes: number;
};

export type NpsPayload = {
  metrics: {
    total: number;
    nps: number;
    facilidad: number;
    trato: number;
    promotores: number;
    detractores: number;
  };
  trend: Array<{ month: string; nps: number; total: number }>;
  dependencias: string[];
  sucursales: string[];
  comments: Array<{
    submit_id: number;
    survey_name: string;
    dependencia: string;
    sucursal_branch: string;
    survey_submitted_at: string;
    comentario_libre: string;
    recomienda_citas: boolean;
    estrellas_facilidad_uso: number | null;
    estrellas_trato_personal: number;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};
