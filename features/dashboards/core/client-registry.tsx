"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import {
  DASHBOARD_MODULES,
  getDashboardManifest,
  type ImplementedDashboardSlug,
} from "./catalog";
import type { DashboardComponentProps } from "@/features/dashboards/shared/types";

type DashboardDefinition = {
  title: string;
  Component: ComponentType<DashboardComponentProps>;
};

function DashboardLoading({ name }: { name: string }) {
  return (
    <div className="app-loading" role="status" aria-live="polite">
      <span>Cargando {name}…</span>
    </div>
  );
}

const COMPONENTS: Record<string, ComponentType<DashboardComponentProps>> = {
  [DASHBOARD_MODULES.nps.slug]: dynamic(
    () => import("@/features/dashboards/modules/nps").then((module) => module.NpsDashboard),
    { loading: () => <DashboardLoading name="NPS" /> },
  ),
  [DASHBOARD_MODULES.refrendos.slug]: dynamic(
    () => import("@/features/dashboards/modules/refrendos").then((module) => module.RefrendosDashboard),
    { loading: () => <DashboardLoading name="Refrendos" /> },
  ),
  [DASHBOARD_MODULES.licencias.slug]: dynamic(
    () => import("@/features/dashboards/modules/licencias").then((module) => module.LicenciasDashboard),
    { loading: () => <DashboardLoading name="Licencias" /> },
  ),
} satisfies Record<ImplementedDashboardSlug, ComponentType<DashboardComponentProps>>;

export function getDashboardDefinition(slug: string): DashboardDefinition | undefined {
  const manifest = getDashboardManifest(slug);
  if (!manifest) return undefined;
  const Component = COMPONENTS[manifest.slug];
  return Component ? { title: manifest.title, Component } : undefined;
}

export function isDashboardRegistered(slug: string): boolean {
  return Boolean(getDashboardDefinition(slug));
}
