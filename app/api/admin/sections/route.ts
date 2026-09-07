import { NextRequest, NextResponse } from "next/server";
import { getDashboardManifest, isDashboardImplemented } from "@/features/dashboards/core/catalog";
import {
  consumeRateLimits,
  RateLimitUnavailableError,
  rateLimitResponse,
  rateLimitUnavailableResponse,
} from "@/lib/rate-limit";
import {
  readLimitedJson,
  RequestSecurityError,
  verifyMutationOrigin,
} from "@/lib/request-security";
import {
  archiveSectionSchema,
  createSectionSchema,
  updateSectionSchema,
  verifyCsrf,
} from "@/lib/security";
import { authenticateRequest, clearSessionCookies } from "@/lib/session";
import { serviceRest } from "@/lib/supabase";
import type { SectionAdminRecord } from "@/features/sections/types";

type AdminContext = Awaited<ReturnType<typeof authenticateRequest>>;
type SectionRow = Omit<SectionAdminRecord, "implemented" | "implementation_slug">;

const SECTION_SELECT = "id,slug,title,description,icon,sort_order,availability,is_active";

async function requireAdmin(request: NextRequest): Promise<AdminContext> {
  const auth = await authenticateRequest(request);
  if (!auth.ok) return auth;
  if (auth.context.user.role !== "administrador") {
    return { ok: false, status: 403, message: "Esta sección es exclusiva para administradores." };
  }
  return auth;
}

function authError(result: Exclude<AdminContext, { ok: true }>) {
  const response = NextResponse.json({ error: result.message }, { status: result.status });
  if (result.clearCookies) clearSessionCookies(response);
  return response;
}

function enrichSection(section: SectionRow): SectionAdminRecord {
  const manifest = getDashboardManifest(section.slug);
  return {
    ...section,
    implemented: Boolean(manifest),
    implementation_slug: manifest?.slug ?? null,
  };
}

function clampPosition(position: number, total: number) {
  return Math.max(1, Math.min(position, Math.max(1, total)));
}

function withDisplayPositions(rows: SectionRow[]): SectionRow[] {
  return rows.map((row, index) => ({ ...row, sort_order: index + 1 }));
}

async function loadAllSections(): Promise<SectionRow[] | null> {
  const response = await serviceRest(
    `app_sections_tym?select=${SECTION_SELECT}&order=sort_order.asc,title.asc`,
  );
  if (!response.ok) return null;
  return (await response.json()) as SectionRow[];
}

async function reindexSections(rows: SectionRow[], movedId: string, requestedPosition: number) {
  const ordered = rows.filter((row) => row.id !== movedId);
  const moved = rows.find((row) => row.id === movedId);
  if (!moved) return false;

  const position = clampPosition(requestedPosition, rows.length);
  ordered.splice(position - 1, 0, moved);

  const results = await Promise.all(
    ordered.map((row, index) => {
      const nextOrder = index + 1;
      if (row.sort_order === nextOrder) return Promise.resolve({ ok: true } as Response);
      return serviceRest(`app_sections_tym?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        body: { sort_order: nextOrder, updated_at: new Date().toISOString() },
      });
    }),
  );

  return results.every((result) => result.ok);
}

async function applyMutationSecurity(request: NextRequest, scope: string, userId: string) {
  if (!verifyMutationOrigin(request)) {
    return NextResponse.json({ error: "Origen de solicitud no autorizado." }, { status: 403 });
  }
  if (!verifyCsrf(request)) {
    return NextResponse.json({ error: "Solicitud no autorizada." }, { status: 403 });
  }

  try {
    const result = await consumeRateLimits([
      {
        scope,
        identifier: userId,
        limit: 120,
        windowSeconds: 60 * 60,
        blockSeconds: 30 * 60,
      },
    ]);
    if (!result.allowed) return rateLimitResponse(result);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  return null;
}

async function readBody(request: NextRequest) {
  try {
    return { ok: true as const, value: await readLimitedJson(request, 12 * 1024) };
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: error.message }, { status: error.status }),
      };
    }
    return {
      ok: false as const,
      response: NextResponse.json({ error: "No fue posible leer la solicitud." }, { status: 400 }),
    };
  }
}

async function audit(
  actorUserId: string,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>,
) {
  const response = await serviceRest("audit_logs_tym", {
    method: "POST",
    body: {
      actor_user_id: actorUserId,
      action,
      target_type: "section",
      target_id: targetId,
      metadata,
    },
  });
  if (!response.ok) {
    console.error("[sections] No fue posible registrar auditoría.", await response.text().catch(() => ""));
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return authError(auth);

  const rows = await loadAllSections();
  if (!rows) {
    return NextResponse.json({ error: "No fue posible cargar las secciones." }, { status: 503 });
  }

  return NextResponse.json(
    { sections: withDisplayPositions(rows).map(enrichSection) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return authError(auth);
  const securityResponse = await applyMutationSecurity(
    request,
    "admin:section-create:actor",
    auth.context.user.id,
  );
  if (securityResponse) return securityResponse;

  const body = await readBody(request);
  if (!body.ok) return body.response;
  const input = createSectionSchema.safeParse(body.value);
  if (!input.success) {
    return NextResponse.json({ error: "Los datos de la sección no son válidos." }, { status: 400 });
  }

  if (input.data.availability === "disponible" && !isDashboardImplemented(input.data.slug)) {
    return NextResponse.json(
      { error: "La sección no puede marcarse como disponible hasta que exista su módulo en el código." },
      { status: 409 },
    );
  }

  const existing = await loadAllSections();
  if (!existing) {
    return NextResponse.json({ error: "No fue posible validar el slug de la sección." }, { status: 503 });
  }

  const sameSlug = existing.find((section) => section.slug === input.data.slug);
  if (sameSlug) {
    return NextResponse.json({ error: "Ya existe una sección con ese slug." }, { status: 409 });
  }

  const requestedManifest = getDashboardManifest(input.data.slug);
  if (requestedManifest) {
    const represented = existing.find((section) => {
      const sectionManifest = getDashboardManifest(section.slug);
      return sectionManifest?.slug === requestedManifest.slug;
    });
    if (represented) {
      return NextResponse.json(
        { error: `Ese tablero ya está representado por la sección "${represented.title}".` },
        { status: 409 },
      );
    }
  }

  const targetPosition = clampPosition(input.data.sortOrder, existing.length + 1);
  const response = await serviceRest("app_sections_tym", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      slug: input.data.slug,
      title: input.data.title,
      description: input.data.description,
      icon: input.data.icon,
      sort_order: targetPosition,
      availability: input.data.availability,
      is_active: input.data.isActive,
    },
  });
  if (!response.ok) {
    console.error("[sections] Error al crear sección.", await response.text().catch(() => ""));
    return NextResponse.json({ error: "No fue posible crear la sección." }, { status: 500 });
  }

  const rows = (await response.json()) as SectionRow[];
  const created = rows[0];
  if (!created) {
    return NextResponse.json({ error: "La sección se creó, pero no fue posible recuperar sus datos." }, { status: 500 });
  }

  const reindexed = await reindexSections([...existing, created], created.id, targetPosition);
  if (!reindexed) {
    return NextResponse.json(
      { error: "La sección se creó, pero no fue posible reorganizar el orden. Vuelve a editarla." },
      { status: 500 },
    );
  }

  await audit(auth.context.user.id, "section.created", created.id, {
    slug: created.slug,
    title: created.title,
    availability: created.availability,
    is_active: created.is_active,
    sort_order: targetPosition,
  });

  return NextResponse.json(
    { section: enrichSection({ ...created, sort_order: targetPosition }) },
    { status: 201 },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return authError(auth);
  const securityResponse = await applyMutationSecurity(
    request,
    "admin:section-update:actor",
    auth.context.user.id,
  );
  if (securityResponse) return securityResponse;

  const body = await readBody(request);
  if (!body.ok) return body.response;
  const input = updateSectionSchema.safeParse(body.value);
  if (!input.success) {
    return NextResponse.json({ error: "Los datos de la sección no son válidos." }, { status: 400 });
  }

  const allSections = await loadAllSections();
  if (!allSections) {
    return NextResponse.json({ error: "No fue posible consultar la sección." }, { status: 503 });
  }

  const current = allSections.find((section) => section.id === input.data.id);
  if (!current) return NextResponse.json({ error: "La sección ya no existe." }, { status: 404 });

  if (input.data.availability === "disponible" && !isDashboardImplemented(current.slug)) {
    return NextResponse.json(
      { error: "La sección no puede marcarse como disponible hasta que exista su módulo en el código." },
      { status: 409 },
    );
  }

  const targetPosition = clampPosition(input.data.sortOrder, allSections.length);
  const response = await serviceRest(`app_sections_tym?id=eq.${encodeURIComponent(input.data.id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: {
      title: input.data.title,
      description: input.data.description,
      icon: input.data.icon,
      availability: input.data.availability,
      is_active: input.data.isActive,
      updated_at: new Date().toISOString(),
    },
  });
  if (!response.ok) {
    console.error("[sections] Error al actualizar sección.", await response.text().catch(() => ""));
    return NextResponse.json({ error: "No fue posible actualizar la sección." }, { status: 500 });
  }

  const updatedWithoutOrder = ((await response.json()) as SectionRow[])[0];
  if (!updatedWithoutOrder) {
    return NextResponse.json({ error: "No fue posible recuperar la sección actualizada." }, { status: 500 });
  }

  const reorderedRows = allSections.map((section) =>
    section.id === updatedWithoutOrder.id ? { ...updatedWithoutOrder, sort_order: section.sort_order } : section,
  );
  const reindexed = await reindexSections(reorderedRows, updatedWithoutOrder.id, targetPosition);
  if (!reindexed) {
    return NextResponse.json({ error: "Los datos se guardaron, pero no fue posible reorganizar las secciones." }, { status: 500 });
  }

  const updated = { ...updatedWithoutOrder, sort_order: targetPosition };

  await audit(auth.context.user.id, "section.updated", updated.id, {
    slug: updated.slug,
    title: updated.title,
    availability: updated.availability,
    is_active: updated.is_active,
    sort_order: targetPosition,
  });

  return NextResponse.json({ section: enrichSection(updated) });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return authError(auth);
  const securityResponse = await applyMutationSecurity(
    request,
    "admin:section-archive:actor",
    auth.context.user.id,
  );
  if (securityResponse) return securityResponse;

  const body = await readBody(request);
  if (!body.ok) return body.response;
  const input = archiveSectionSchema.safeParse(body.value);
  if (!input.success) {
    return NextResponse.json({ error: "La sección indicada no es válida." }, { status: 400 });
  }

  const currentResponse = await serviceRest(
    `app_sections_tym?id=eq.${encodeURIComponent(input.data.id)}&select=id,slug,title,is_active&limit=1`,
  );
  if (!currentResponse.ok) {
    return NextResponse.json({ error: "No fue posible consultar la sección." }, { status: 503 });
  }
  const current = ((await currentResponse.json()) as Array<{ id: string; slug: string; title: string; is_active: boolean }>)[0];
  if (!current) return NextResponse.json({ error: "La sección ya no existe." }, { status: 404 });

  if (!current.is_active) return NextResponse.json({ ok: true });

  const response = await serviceRest(`app_sections_tym?id=eq.${encodeURIComponent(input.data.id)}`, {
    method: "PATCH",
    body: { is_active: false, updated_at: new Date().toISOString() },
  });
  if (!response.ok) {
    return NextResponse.json({ error: "No fue posible desactivar la sección." }, { status: 500 });
  }

  await audit(auth.context.user.id, "section.archived", current.id, {
    slug: current.slug,
    title: current.title,
  });

  return NextResponse.json({ ok: true });
}
