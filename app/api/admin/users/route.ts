import { NextRequest, NextResponse } from "next/server";
import {
  consumeRateLimits,
  RateLimitUnavailableError,
  rateLimitResponse,
  rateLimitUnavailableResponse,
} from "../../../../lib/rate-limit";
import {
  readLimitedJson,
  RequestSecurityError,
  verifyMutationOrigin,
} from "../../../../lib/request-security";
import {
  hashToken,
  invitationSchema,
  randomToken,
  resendInvitationSchema,
  updateUserSchema,
  verifyCsrf,
} from "../../../../lib/security";
import { sendInvitationEmail } from "../../../../lib/email";
import { authenticateRequest, clearSessionCookies } from "../../../../lib/session";
import { serviceRest } from "../../../../lib/supabase";

type AdminContext = Awaited<ReturnType<typeof authenticateRequest>>;

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

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return authError(auth);

  const [profilesResponse, sectionsResponse, permissionsResponse, invitationsResponse, invitationPermissionsResponse] =
    await Promise.all([
      serviceRest("profiles_tym?select=id,email,full_name,role,status,created_at,updated_at&order=created_at.desc"),
      serviceRest("app_sections_tym?select=id,slug,title,availability,is_active&order=sort_order.asc"),
      serviceRest("user_section_permissions_tym?select=user_id,section_id,can_view,can_edit,can_export"),
      serviceRest("invitations_tym?select=id,email,full_name,role,status,expires_at,sent_at,send_count,created_at&order=created_at.desc&limit=100"),
      serviceRest("invitation_section_permissions_tym?select=invitation_id,section_id"),
    ]);
  if (![profilesResponse, sectionsResponse, permissionsResponse, invitationsResponse, invitationPermissionsResponse].every((response) => response.ok)) {
    return NextResponse.json({ error: "No fue posible cargar la administración de usuarios." }, { status: 503 });
  }

  const sections = (await sectionsResponse.json()) as Array<{
    id: string;
    slug: string;
    title: string;
    availability: "disponible" | "proximamente";
    is_active: boolean;
  }>;

  return NextResponse.json({
    users: await profilesResponse.json(),
    sections: sections.map((section) => (
      section.slug === "dashboard-2"
        ? { ...section, availability: "disponible" as const }
        : section
    )),
    permissions: await permissionsResponse.json(),
    invitations: await invitationsResponse.json(),
    invitationPermissions: await invitationPermissionsResponse.json(),
  });
}

export async function POST(request: NextRequest) {
  if (!verifyMutationOrigin(request)) {
    return NextResponse.json({ error: "Origen de solicitud no autorizado." }, { status: 403 });
  }
  if (!verifyCsrf(request)) return NextResponse.json({ error: "Solicitud no autorizada." }, { status: 403 });
  const auth = await requireAdmin(request);
  if (!auth.ok) return authError(auth);

  try {
    const actorLimit = await consumeRateLimits([
      {
        scope: "admin:invitation:actor",
        identifier: auth.context.user.id,
        limit: 60,
        windowSeconds: 60 * 60,
        blockSeconds: 60 * 60,
      },
    ]);
    if (!actorLimit.allowed) return rateLimitResponse(actorLimit);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  let raw: unknown;
  try {
    raw = await readLimitedJson(request, 16 * 1024);
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "No fue posible leer la solicitud." }, { status: 400 });
  }

  const resendInput = resendInvitationSchema.safeParse(raw);
  if (resendInput.success) {
    return resendInvitation(request, auth.context.user.id, resendInput.data.invitationId);
  }
  const input = invitationSchema.safeParse(raw);
  if (!input.success) {
    return NextResponse.json({ error: input.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    const recipientLimit = await consumeRateLimits([
      {
        scope: "admin:invitation:recipient",
        identifier: input.data.email,
        limit: 5,
        windowSeconds: 60 * 60,
        blockSeconds: 60 * 60,
      },
    ]);
    if (!recipientLimit.allowed) return rateLimitResponse(recipientLimit);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  const existingUserResponse = await serviceRest(
    `profiles_tym?email=eq.${encodeURIComponent(input.data.email)}&select=id&limit=1`,
  );
  if (existingUserResponse.ok && ((await existingUserResponse.json()) as Array<{ id: string }>).length) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
  }

  const token = randomToken(32);
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const insertResponse = await serviceRest("invitations_tym", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: {
      email: input.data.email,
      full_name: input.data.fullName,
      role: input.data.role,
      token_hash: tokenHash,
      status: "pendiente",
      expires_at: expiresAt,
      created_by: auth.context.user.id,
      send_count: 1,
    },
  });
  if (!insertResponse.ok) {
    return NextResponse.json({ error: "Ya existe una invitación pendiente o una cuenta con ese correo." }, { status: 409 });
  }
  const invitation = ((await insertResponse.json()) as Array<{ id: string }>)[0];
  if (input.data.sectionIds.length) {
    await serviceRest("invitation_section_permissions_tym", {
      method: "POST",
      body: input.data.sectionIds.map((sectionId) => ({ invitation_id: invitation.id, section_id: sectionId })),
    });
  }

  try {
    const delivery = await sendInvitationEmail({
      email: input.data.email,
      fullName: input.data.fullName,
      token,
      origin: request.nextUrl.origin,
    });
    if (delivery.sent) {
      await serviceRest(`invitations_tym?id=eq.${invitation.id}`, {
        method: "PATCH",
        body: { sent_at: new Date().toISOString() },
      });
    }
    await logAdminAction(auth.context.user.id, "invitation.created", "invitation", invitation.id, {
      email: input.data.email,
      delivered: delivery.sent,
      provider: delivery.provider,
    });
    return NextResponse.json({
      ok: true,
      delivered: delivery.sent,
      expiresAt,
      manualInviteUrl: delivery.sent ? undefined : delivery.inviteUrl,
    });
  } catch (error) {
    const warning = error instanceof Error ? error.message : "No fue posible enviar el correo.";
    await logAdminAction(auth.context.user.id, "invitation.created", "invitation", invitation.id, {
      email: input.data.email,
      delivered: false,
      warning,
    });
    return NextResponse.json({
      ok: true,
      delivered: false,
      expiresAt,
      warning: `La invitación fue creada, pero el correo no se entregó: ${warning}`,
      manualInviteUrl: `${request.nextUrl.origin}/?invite=${encodeURIComponent(token)}`,
    });
  }
}

export async function PATCH(request: NextRequest) {
  if (!verifyMutationOrigin(request)) {
    return NextResponse.json({ error: "Origen de solicitud no autorizado." }, { status: 403 });
  }
  if (!verifyCsrf(request)) return NextResponse.json({ error: "Solicitud no autorizada." }, { status: 403 });
  const auth = await requireAdmin(request);
  if (!auth.ok) return authError(auth);

  try {
    const actorLimit = await consumeRateLimits([
      {
        scope: "admin:user-update:actor",
        identifier: auth.context.user.id,
        limit: 120,
        windowSeconds: 10 * 60,
        blockSeconds: 15 * 60,
      },
    ]);
    if (!actorLimit.allowed) return rateLimitResponse(actorLimit);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  let raw: unknown;
  try {
    raw = await readLimitedJson(request, 16 * 1024);
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "No fue posible leer la solicitud." }, { status: 400 });
  }
  const input = updateUserSchema.safeParse(raw);
  if (!input.success) return NextResponse.json({ error: "Datos de usuario inválidos." }, { status: 400 });
  if (input.data.userId === auth.context.user.id && (input.data.status !== "activo" || input.data.role !== "administrador")) {
    return NextResponse.json({ error: "No puedes quitarte tu propio acceso administrativo." }, { status: 409 });
  }

  const profileResponse = await serviceRest(`profiles_tym?id=eq.${input.data.userId}`, {
    method: "PATCH",
    body: { full_name: input.data.fullName, role: input.data.role, status: input.data.status },
  });
  if (!profileResponse.ok) return NextResponse.json({ error: "No fue posible actualizar el usuario." }, { status: 500 });

  await serviceRest(`user_section_permissions_tym?user_id=eq.${input.data.userId}`, { method: "DELETE" });
  if (input.data.sectionIds.length) {
    await serviceRest("user_section_permissions_tym", {
      method: "POST",
      body: input.data.sectionIds.map((sectionId) => ({
        user_id: input.data.userId,
        section_id: sectionId,
        can_view: true,
        can_edit: input.data.role !== "consulta",
        can_export: true,
      })),
    });
  }
  if (input.data.status === "inactivo") {
    await serviceRest(`app_sessions_tym?user_id=eq.${input.data.userId}&revoked_at=is.null`, {
      method: "PATCH",
      body: { revoked_at: new Date().toISOString() },
    });
  }
  await logAdminAction(auth.context.user.id, "user.updated", "user", input.data.userId, {
    role: input.data.role,
    status: input.data.status,
    sections: input.data.sectionIds,
  });
  return NextResponse.json({ ok: true });
}

async function resendInvitation(request: NextRequest, actorId: string, invitationId: string) {
  const response = await serviceRest(
    `invitations_tym?id=eq.${encodeURIComponent(invitationId)}&select=id,email,full_name,status&limit=1`,
  );
  const invitation = response.ok
    ? ((await response.json()) as Array<{ id: string; email: string; full_name: string; status: string }>)[0]
    : null;
  if (!invitation || invitation.status === "aceptada" || invitation.status === "revocada") {
    return NextResponse.json({ error: "La invitación ya no puede reenviarse." }, { status: 409 });
  }

  try {
    const recipientLimit = await consumeRateLimits([
      {
        scope: "admin:invitation:recipient",
        identifier: invitation.email.toLowerCase(),
        limit: 5,
        windowSeconds: 60 * 60,
        blockSeconds: 60 * 60,
      },
    ]);
    if (!recipientLimit.allowed) return rateLimitResponse(recipientLimit);
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  const token = randomToken(32);
  const tokenHash = await hashToken(token);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  const updateResponse = await serviceRest(`invitations_tym?id=eq.${invitation.id}`, {
    method: "PATCH",
    body: {
      token_hash: tokenHash,
      status: "pendiente",
      expires_at: expiresAt,
      sent_at: null,
    },
  });
  if (!updateResponse.ok) {
    return NextResponse.json({ error: "No fue posible preparar el nuevo enlace." }, { status: 500 });
  }

  let delivered = false;
  let provider = "manual";
  let warning: string | undefined;
  try {
    const delivery = await sendInvitationEmail({
      email: invitation.email,
      fullName: invitation.full_name,
      token,
      origin: request.nextUrl.origin,
    });
    delivered = delivery.sent;
    provider = delivery.provider;
  } catch (error) {
    warning = error instanceof Error ? error.message : "No fue posible enviar el correo.";
  }
  if (delivered) {
    await serviceRest(`invitations_tym?id=eq.${invitation.id}`, {
      method: "PATCH",
      body: { sent_at: new Date().toISOString() },
    });
  }
  await serviceRest("rpc/increment_invitation_send_count_tym", { body: { p_invitation_id: invitation.id } });
  await logAdminAction(actorId, "invitation.resent", "invitation", invitation.id, {
    delivered,
    provider,
    warning,
  });
  return NextResponse.json({
    ok: true,
    delivered,
    expiresAt,
    warning: warning ? `El enlace fue renovado, pero el correo no se entregó: ${warning}` : undefined,
    manualInviteUrl: delivered
      ? undefined
      : `${request.nextUrl.origin}/?invite=${encodeURIComponent(token)}`,
  });
}

async function logAdminAction(
  actorUserId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown>,
) {
  await serviceRest("audit_logs_tym", {
    method: "POST",
    body: { actor_user_id: actorUserId, action, target_type: targetType, target_id: targetId, metadata },
  });
}
