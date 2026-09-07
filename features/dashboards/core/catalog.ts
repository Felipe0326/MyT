import { licenciasManifest } from "@/features/dashboards/modules/licencias/manifest";
import { npsManifest } from "@/features/dashboards/modules/nps/manifest";
import { refrendosManifest } from "@/features/dashboards/modules/refrendos/manifest";
import type { DashboardManifest } from "./types";

export const DASHBOARD_MODULES = {
  nps: npsManifest,
  refrendos: refrendosManifest,
  licencias: licenciasManifest,
} as const satisfies Record<string, DashboardManifest>;

export type DashboardModuleKey = keyof typeof DASHBOARD_MODULES;
export type ImplementedDashboardManifest =
  (typeof DASHBOARD_MODULES)[DashboardModuleKey];
export type ImplementedDashboardSlug = ImplementedDashboardManifest["slug"];

export const DASHBOARD_MANIFESTS = Object.values(DASHBOARD_MODULES);

export function getDashboardManifest(
  slug: string,
): ImplementedDashboardManifest | undefined {
  return DASHBOARD_MANIFESTS.find((manifest) => {
    const aliases = "aliases" in manifest
      ? manifest.aliases as readonly string[]
      : [];

    return manifest.slug === slug || aliases.includes(slug);
  });
}

export function isDashboardImplemented(slug: string): boolean {
  return Boolean(getDashboardManifest(slug));
}

export function shouldTreatSectionAsAvailable(_slug: string, availability: string): boolean {
  return availability === "disponible";
}
