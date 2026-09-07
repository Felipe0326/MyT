import type { NextRequest, NextResponse } from "next/server";
import type { SessionContext } from "@/lib/session";
import type { N8nDashboard } from "@/lib/n8n-webhook";

export type DashboardPermission = "view" | "edit" | "export";

export type DashboardManifest = {
  slug: string;
  permissionSlug: string;
  aliases?: readonly string[];
  title: string;
  refresh?: {
    dashboard: N8nDashboard;
    successMessage: string;
  };
};

export type DashboardServerContext = {
  request: NextRequest;
  session: SessionContext;
};

export type DashboardServerModule = {
  getData: (context: DashboardServerContext) => Promise<NextResponse>;
  exportData?: (context: DashboardServerContext) => Promise<NextResponse>;
  datasets?: Record<string, (context: DashboardServerContext) => Promise<NextResponse>>;
};
