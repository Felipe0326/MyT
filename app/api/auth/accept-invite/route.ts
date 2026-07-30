import { NextRequest, NextResponse } from "next/server";
import {
  clientRateLimitRule,
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
import { acceptInvitationSchema, hashToken } from "../../../../lib/security";
import {
  adminCreateUser,
  adminFindUserByEmail,
  adminUpdateUserPassword,
  serviceRest,
} from "../../../../lib/supabase";

type Invitation = {
  id: string;
  email: string;
  full_name: string;
  role: "administrador" | "editor" | "consulta";
  status: "pendiente" | "aceptada" | "expirada" | "revocada";
  expires_at: string;
};

export async function POST(request: NextRequest) {
  if (!verifyMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origen de solicitud no autorizado." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  let raw: unknown;
  try {
    const clientLimit = await consumeRateLimits([
      clientRateLimitRule(request, "auth:invite-accept:ip", 15, 15 * 60, 30 * 60),
    ]);
    if (!clientLimit.allowed) return rateLimitResponse(clientLimit);
    raw = await readLimitedJson(request, 8 * 1024);
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    return rateLimitUnavailableResponse();
  }

  const input = acceptInvitationSchema.safeParse(raw);
  if (!input.success) {
    return NextResponse.json(
      { error: input.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const tokenHash = await hashToken(input.data.token);
    const tokenLimit = await consumeRateLimits([
      {
        scope: "auth:invite-accept:token",
        identifier: tokenHash,
        limit: 6,
        windowSeconds: 15 * 60,
        blockSeconds: 60 * 60,
      },
    ]);
    if (!tokenLimit.allowed) return rateLimitResponse(tokenLimit);

    const invitationResponse = await serviceRest(
      `invitations_tym?token_hash=eq.${tokenHash}&select=id,email,full_name,role,status,expires_at&limit=1`,
    );
    if (!invitationResponse.ok) {
      return NextResponse.json({ error: "El sistema de invitaciones aún no está disponible." }, { status: 503 });
    }
    const invitation = ((await invitationResponse.json()) as Invitation[])[0];
    if (!invitation || invitation.status !== "pendiente") {
      return NextResponse.json({ error: "La invitación no existe o ya fue utilizada." }, { status: 410 });
    }
    if (Date.now() > new Date(invitation.expires_at).getTime()) {
      await serviceRest(`invitations_tym?id=eq.${invitation.id}`, { method: "PATCH", body: { status: "expirada" } });
      return NextResponse.json({ error: "La invitación venció. Solicita al administrador que la reenvíe." }, { status: 410 });
    }

    const existingAuthUser = await adminFindUserByEmail(invitation.email);
    const user = existingAuthUser
      ? existingAuthUser
      : await adminCreateUser({
          email: invitation.email,
          password: input.data.password,
          fullName: invitation.full_name,
        });

    // Si el correo ya pertenecía a otro sistema que usa el mismo Supabase Auth,
    // se conserva su UUID y solo se actualiza la contraseña capturada en esta invitación.
    if (existingAuthUser) {
      await adminUpdateUserPassword(existingAuthUser.id, input.data.password);
    }

    const permissionsResponse = await serviceRest(
      `invitation_section_permissions_tym?invitation_id=eq.${invitation.id}&select=section_id`,
    );
    if (!permissionsResponse.ok) {
      throw new Error("No fue posible consultar los tableros asignados.");
    }
    const permissions = (await permissionsResponse.json()) as Array<{ section_id: string }>;

    // POST con on_conflict permite crear profiles_tym cuando el usuario ya existía
    // en auth.users, o actualizar el perfil generado por el trigger para usuarios nuevos.
    const profileResponse = await serviceRest("profiles_tym?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: {
        id: user.id,
        email: invitation.email.trim().toLowerCase(),
        full_name: invitation.full_name,
        role: invitation.role,
        status: "activo",
      },
    });
    if (!profileResponse.ok) {
      throw new Error("No fue posible registrar el perfil del usuario en Movilidad TYM.");
    }

    // Para administradores no se guardan permisos individuales: el rol concede
    // acceso total. En los demás roles, la invitación define las secciones.
    const clearPermissionsResponse = await serviceRest(
      `user_section_permissions_tym?user_id=eq.${user.id}`,
      { method: "DELETE" },
    );
    if (!clearPermissionsResponse.ok) {
      throw new Error("No fue posible preparar los permisos del usuario.");
    }

    if (invitation.role !== "administrador" && permissions.length) {
      const grantResponse = await serviceRest(
        "user_section_permissions_tym?on_conflict=user_id,section_id",
        {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: permissions.map(({ section_id }) => ({
            user_id: user.id,
            section_id,
            can_view: true,
            can_edit: invitation.role !== "consulta",
            can_export: true,
          })),
        },
      );
      if (!grantResponse.ok) throw new Error("No fue posible asignar los tableros.");
    }

    await serviceRest(`invitations_tym?id=eq.${invitation.id}&status=eq.pendiente`, {
      method: "PATCH",
      body: { status: "aceptada", accepted_at: new Date().toISOString(), accepted_user_id: user.id },
    });
    await serviceRest("audit_logs_tym", {
      method: "POST",
      body: {
        actor_user_id: user.id,
        action: "invitation.accepted",
        target_type: "user",
        target_id: user.id,
        metadata: { invitation_id: invitation.id },
      },
    });

    return NextResponse.json({ ok: true, email: invitation.email });
  } catch (error) {
    if (error instanceof RateLimitUnavailableError) return rateLimitUnavailableResponse();
    const message = error instanceof Error ? error.message : "No fue posible aceptar la invitación.";
    return NextResponse.json(
      { error: message },
      {
        status: /Ya existe/.test(message) ? 409 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
