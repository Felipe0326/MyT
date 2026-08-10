import type { NextRequest } from "next/server";
import { handleDashboardRefresh } from "../../../../lib/dashboard-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handleDashboardRefresh(request, {
    dashboard: "licencias",
    sectionSlug: "dashboard-licencias",
    successMessage: "La actualización de Licencias fue solicitada correctamente.",
  });
}
