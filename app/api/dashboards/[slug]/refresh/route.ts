import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getDashboardManifest } from "@/features/dashboards/core/catalog";
import { handleDashboardRefresh } from "@/lib/dashboard-refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const manifest = getDashboardManifest(slug);
  if (!manifest?.refresh) {
    return NextResponse.json(
      { error: "Este tablero no tiene actualización manual habilitada." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return handleDashboardRefresh(request, {
    dashboard: manifest.refresh.dashboard,
    sectionSlug: manifest.permissionSlug,
    successMessage: manifest.refresh.successMessage,
  });
}
