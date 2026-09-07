import type { DashboardManifest } from "@/features/dashboards/core/types";

export const npsManifest = {
  slug: "dashboard-nps",
  permissionSlug: "dashboard-nps",
  title: "NPS",
  refresh: {
    dashboard: "nps",
    successMessage: "NPS actualizado correctamente.",
  },
} as const satisfies DashboardManifest;
