import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "@/features/dashboards/core/server";
import { getDashboardServer } from "@/features/dashboards/core/server-registry";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const authorization = await authorizeDashboardRequest(request, slug, "export");
  if (!authorization.ok) return authorization.response;

  const server = getDashboardServer(slug);
  if (!server?.exportData) {
    return NextResponse.json(
      { error: "Este tablero no tiene exportación habilitada." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return server.exportData({ request, session: authorization.session });
}
