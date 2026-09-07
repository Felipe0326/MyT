import type { DashboardManifest } from "@/features/dashboards/core/types";

export const licenciasManifest = {
  slug: "dashboard-licencias",
  permissionSlug: "dashboard-licencias",
  title: "Licencias",
  refresh: {
    dashboard: "licencias",
    successMessage: "Licencias actualizadas correctamente.",
  },
} as const satisfies DashboardManifest;
