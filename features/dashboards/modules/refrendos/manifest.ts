import type { DashboardManifest } from "@/features/dashboards/core/types";

export const refrendosManifest = {
  slug: "dashboard-refrendos",
  // La base actual conserva este slug. El legado queda aislado aquí.
  permissionSlug: "dashboard-2",
  aliases: ["dashboard-2"],
  title: "Refrendos",
  refresh: {
    dashboard: "refrendos",
    successMessage: "Refrendos actualizados correctamente.",
  },
} as const satisfies DashboardManifest;
