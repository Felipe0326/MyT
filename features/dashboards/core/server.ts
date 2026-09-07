import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, clearSessionCookies } from "@/lib/session";
import { getDashboardManifest } from "./catalog";
import type { DashboardPermission } from "./types";

const PERMISSION_FIELD = {
  view: "can_view",
  edit: "can_edit",
  export: "can_export",
} as const;

export async function authorizeDashboardRequest(
  request: NextRequest,
  slug: string,
  permission: DashboardPermission,
) {
  const manifest = getDashboardManifest(slug);
  if (!manifest) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: "El tablero solicitado no está implementado." },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  const auth = await authenticateRequest(request);
  if (!auth.ok) {
    const response = NextResponse.json(
      { error: auth.message },
      { status: auth.status, headers: { "Cache-Control": "no-store" } },
    );
    if (auth.clearCookies) clearSessionCookies(response);
    return { ok: false as const, response };
  }

  const permissionField = PERMISSION_FIELD[permission];
  const section = auth.context.sections.find(
    (item) =>
      item.slug === manifest.permissionSlug &&
      item.availability === "disponible" &&
      item[permissionField],
  );

  if (!section) {
    const action = permission === "export"
      ? "exportar"
      : permission === "edit"
        ? "actualizar"
        : "ver";
    return {
      ok: false as const,
      response: NextResponse.json(
        { error: `No tienes permiso para ${action} este tablero.` },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  return {
    ok: true as const,
    manifest,
    session: auth.context,
  };
}
