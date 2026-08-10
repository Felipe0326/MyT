import type { NextRequest } from "next/server";
import { handleDashboardRefresh } from "../../../../lib/dashboard-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handleDashboardRefresh(request, {
    dashboard: "refrendos",
    sectionSlug: "dashboard-2",
    successMessage: "La actualización de Refrendos fue solicitada correctamente.",
  });
}
