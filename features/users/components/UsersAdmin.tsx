"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  MailPlus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from "lucide-react";
import type { AppRole } from "@/lib/session";
import { InviteForm, UserEditor } from "@/features/users/components/UserManagementForms";
import { initials } from "@/features/users/lib/display";
import type {
  AdminPayload,
  InvitationRecord,
  MutateMethod,
  UserRecord,
} from "@/features/users/types";

export function UsersAdmin({
  csrfToken,
  currentUserId,
}: {
  csrfToken: string;
  currentUserId: string;
}) {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [now, setNow] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<UserRecord | null>(null);
  const [deletingUserId, setDeletingUserId] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = (await response.json()) as AdminPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible cargar los usuarios.");
      }

      setData(payload);
      setNow(Date.now());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, []);


  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 5_000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 7_000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  async function mutate(method: MutateMethod, body: unknown) {
    const response = await fetch("/api/admin/users", {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as {
      error?: string;
      warning?: string;
      manualInviteUrl?: string;
      delivered?: boolean | null;
      deliveryStatus?: "processing" | "sent" | "failed";
      invitation?: InvitationRecord;
    };

    if (!response.ok) {
      if (payload.manualInviteUrl) setManualUrl(payload.manualInviteUrl);
      throw new Error(payload.error ?? "No fue posible guardar el cambio.");
    }

    if (payload.manualInviteUrl) setManualUrl(payload.manualInviteUrl);
    return payload;
  }

  async function invite(input: {
    email: string;
    fullName: string;
    role: AppRole;
    sectionIds: string[];
  }) {
    setError("");
    setNotice("");

    const payload = await mutate("POST", {
      action: "invite",
      ...input,
      sectionIds: input.role === "administrador" ? [] : input.sectionIds,
    });

    setNotice(
      payload.deliveryStatus === "processing"
        ? "Invitación creada. El correo se está enviando."
        : payload.delivered
          ? "Invitación enviada correctamente."
          : payload.warning ?? "Invitación creada.",
    );

    if (payload.invitation) {
      setData((current) =>
        current
          ? {
              ...current,
              invitations: [
                payload.invitation as InvitationRecord,
                ...current.invitations.filter(
                  (invitation) => invitation.id !== payload.invitation?.id,
                ),
              ],
            }
          : current,
      );
      setNow(Date.now());
    }

    setShowInvite(false);
  }

  async function resend(invitationId: string) {
    setError("");

    try {
      const payload = await mutate("POST", { action: "resend", invitationId });
      setNotice(
        payload.deliveryStatus === "processing"
          ? "Enlace renovado. El correo se está reenviando."
          : payload.delivered
            ? "Invitación reenviada; el enlace anterior quedó invalidado."
            : payload.warning ?? "Se generó un enlace nuevo de 48 horas.",
      );

      if (payload.invitation) {
        setData((current) =>
          current
            ? {
                ...current,
                invitations: current.invitations.map((invitation) =>
                  invitation.id === payload.invitation?.id
                    ? (payload.invitation as InvitationRecord)
                    : invitation,
                ),
              }
            : current,
        );
        setNow(Date.now());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible reenviar la invitación.");
    }
  }

  async function requestDelete(user: UserRecord) {
    setError("");
    setPendingDelete(user);
  }

  async function confirmDelete() {
    if (!pendingDelete || deletingUserId) return;

    const user = pendingDelete;
    setDeletingUserId(user.id);
    setError("");
    setNotice("");

    try {
      await mutate("DELETE", { userId: user.id });

      setData((current) =>
        current
          ? {
              ...current,
              users: current.users.filter((item) => item.id !== user.id),
              permissions: current.permissions.filter(
                (permission) => permission.user_id !== user.id,
              ),
            }
          : current,
      );

      setPendingDelete(null);
      setNotice(`${user.full_name} se eliminó correctamente.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible eliminar el usuario.");
    } finally {
      setDeletingUserId("");
    }
  }

  const pending =
    data?.invitations.filter(
      (invitation) => invitation.status !== "aceptada" && invitation.status !== "revocada",
    ) ?? [];

  return (
    <div className="dashboard-stack">
      <header className="content-heading admin-heading">
        <div className="admin-heading-copy">
          <p className="eyebrow">Administración</p>
          <h1>Usuarios y permisos</h1>
          <p>
            Los administradores tienen acceso total. Para los demás roles puedes asignar los
            tableros permitidos.
          </p>
        </div>

        <button className="primary-button" onClick={() => setShowInvite(true)}>
          <MailPlus size={17} /> Nuevo usuario
        </button>
      </header>

      <section className="admin-stats">
        <div>
          <i><Users size={20} /></i>
          <span><strong>{data?.users.length ?? 0}</strong> Usuarios registrados</span>
        </div>
        <div>
          <i><Shield size={20} /></i>
          <span>
            <strong>
              {data?.users.filter((user) => user.role === "administrador").length ?? 0}
            </strong>{" "}
            Administradores
          </span>
        </div>
        <div>
          <i><MailPlus size={20} /></i>
          <span><strong>{pending.length}</strong> Invitaciones pendientes</span>
        </div>
      </section>

      {notice && <div className="form-success"><Check size={17} /> {notice}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}

      {manualUrl && (
        <div className="manual-link">
          <div>
            <strong>Enlace temporal</strong>
            <span>Úsalo solamente mientras se configura el proveedor de correo.</span>
          </div>
          <code>{manualUrl}</code>
          <button
            className="secondary-button"
            onClick={() => navigator.clipboard.writeText(manualUrl)}
          >
            <Copy size={15} /> Copiar
          </button>
        </div>
      )}

      {showInvite && data && (
        <InviteForm
          sections={data.sections}
          onCancel={() => setShowInvite(false)}
          onSubmit={invite}
        />
      )}

      <section className="surface user-list-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Directorio</p>
            <h2>Usuarios activos e inactivos</h2>
          </div>
          {loading && <span>Actualizando…</span>}
        </div>

        <div className="user-list">
          {data?.users.map((user) => (
            <UserEditor
              key={user.id}
              user={user}
              sections={data.sections}
              initialSections={data.permissions
                .filter((permission) => permission.user_id === user.id && permission.can_view)
                .map((permission) => permission.section_id)}
              isCurrent={user.id === currentUserId}
              onSave={async (body) => {
                await mutate("PATCH", body);

                setData((current) =>
                  current
                    ? {
                        ...current,
                        users: current.users.map((item) =>
                          item.id === body.userId
                            ? {
                                ...item,
                                full_name: body.fullName,
                                role: body.role,
                                status: body.status,
                              }
                            : item,
                        ),
                        permissions: [
                          ...current.permissions.filter(
                            (permission) => permission.user_id !== body.userId,
                          ),
                          ...(body.role === "administrador"
                            ? []
                            : body.sectionIds.map((sectionId) => ({
                                user_id: body.userId,
                                section_id: sectionId,
                                can_view: true,
                              }))),
                        ],
                      }
                    : current,
                );

                setNotice("Usuario y permisos actualizados.");
              }}
              onDelete={() => requestDelete(user)}
            />
          ))}

          {!loading && !data?.users.length && (
            <div className="empty-table">No hay usuarios registrados.</div>
          )}
        </div>
      </section>

      <section className="surface invitations-card">
        <div className="card-heading">
          <div>
            <p className="eyebrow">Seguimiento</p>
            <h2>Invitaciones</h2>
          </div>
        </div>

        <div className="invitation-list">
          {pending.map((invitation) => {
            const expired = now > new Date(invitation.expires_at).getTime();

            return (
              <div key={invitation.id} className="invitation-row">
                <div className="avatar small invitation-avatar">
                  {initials(invitation.full_name)}
                </div>

                <div className="invitation-primary">
                  <strong>{invitation.full_name}</strong>
                  <span>{invitation.email}</span>
                </div>

                <div className="invitation-meta">
                  <span className={`status-badge ${expired ? "status-expired" : "status-pending"}`}>
                    {expired ? "Vencida" : "Pendiente"}
                  </span>
                  <span className="invite-date">
                    Vence{" "}
                    {new Date(invitation.expires_at).toLocaleString("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <button
                  className="secondary-button invitation-action"
                  onClick={() => resend(invitation.id)}
                >
                  <RefreshCw size={14} /> Reenviar
                </button>
              </div>
            );
          })}

          {!pending.length && (
            <div className="empty-table">No hay invitaciones pendientes.</div>
          )}
        </div>
      </section>

      {pendingDelete && (
        <div
          className="delete-user-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingUserId) {
              setPendingDelete(null);
            }
          }}
        >
          <section
            className="delete-user-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-user-title"
            aria-describedby="delete-user-description"
          >
            <div className="delete-user-icon" aria-hidden="true">
              <Trash2 size={22} />
            </div>

            <p className="eyebrow">Confirmación</p>
            <h2 id="delete-user-title">Eliminar a {pendingDelete.full_name}</h2>
            <p id="delete-user-description">
              Se eliminará permanentemente de este sistema.
            </p>

            <div className="delete-user-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={Boolean(deletingUserId)}
                onClick={() => setPendingDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={Boolean(deletingUserId)}
                onClick={confirmDelete}
              >
                <Trash2 size={15} />
                {deletingUserId ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
