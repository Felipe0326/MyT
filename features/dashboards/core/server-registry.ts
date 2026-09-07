import "server-only";

import { licenciasServer } from "@/features/dashboards/modules/licencias/server";
import { npsServer } from "@/features/dashboards/modules/nps/server";
import { refrendosServer } from "@/features/dashboards/modules/refrendos/server";
import {
  DASHBOARD_MODULES,
  getDashboardManifest,
  type ImplementedDashboardSlug,
} from "./catalog";
import type { DashboardServerModule } from "./types";

const SERVERS: Record<string, DashboardServerModule> = {
  [DASHBOARD_MODULES.nps.slug]: npsServer,
  [DASHBOARD_MODULES.refrendos.slug]: refrendosServer,
  [DASHBOARD_MODULES.licencias.slug]: licenciasServer,
} satisfies Record<ImplementedDashboardSlug, DashboardServerModule>;

export function getDashboardServer(slug: string): DashboardServerModule | undefined {
  const manifest = getDashboardManifest(slug);
  return manifest ? SERVERS[manifest.slug] : undefined;
}
