import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { authorizeDashboardRequest } from "@/features/dashboards/core/server";
import { getDashboardServer } from "@/features/dashboards/core/server-registry";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ slug: string; dataset: string }> };

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { slug, dataset } = await params;
  const authorization = await authorizeDashboardRequest(request, slug, "view");
  if (!authorization.ok) return authorization.response;

  const handler = getDashboardServer(slug)?.datasets?.[dataset];
  if (!handler) {
    return NextResponse.json(
      { error: "El conjunto de datos solicitado no está disponible." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  return handler({ request, session: authorization.session });
}
