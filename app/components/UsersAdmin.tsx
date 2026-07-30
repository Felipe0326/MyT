"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Check,
  Copy,
  MailPlus,
  RefreshCw,
  Save,
  Shield,
  Trash2,
  UserRoundCog,
  Users,
} from "lucide-react";
import type { AppRole } from "../../lib/session";

type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: "activo" | "inactivo";
  created_at: string;
};

type SectionRecord = {
  id: string;
  slug: string;
  title: string;
  availability: string;
  is_active: boolean;
};

type PermissionRecord = {
  user_id: string;
  section_id: string;
  can_view: boolean;
};

type InvitationRecord = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: string;
  expires_at: string;
  sent_at: string | null;
  send_count: number;
};

type AdminPayload = {
  users: UserRecord[];
  sections: SectionRecord[];
  permissions: PermissionRecord[];
  invitations: InvitationRecord[];
  invitationPermissions: Array<{ invitation_id: string; section_id: string }>;
};

type MutateMethod = "POST" | "PATCH" | "DELETE";

function isSectionAvailable(section: SectionRecord) {
  return section.availability === "disponible" || section.slug === "dashboard-2";
}

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

function InviteForm({
  sections,
  onCancel,
  onSubmit,
}: {
  sections: SectionRecord[];
  onCancel: () => void;
  onSubmit: (input: {
    email: string;
    fullName: string;
    role: AppRole;
    sectionIds: string[];
  }) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("consulta");
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 7_000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  function changeRole(nextRole: AppRole) {
    setRole(nextRole);
    if (nextRole === "administrador") setSectionIds([]);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      await onSubmit({
        email,
        fullName,
        role,
        sectionIds: role === "administrador" ? [] : sectionIds,
      });
      setEmail("");
      setFullName("");
      setRole("consulta");
      setSectionIds([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible crear la invitación.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="surface invite-form-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">Acceso nuevo</p>
          <h2>Invitar usuario</h2>
        </div>
        <button className="text-button" onClick={onCancel}>Cancelar</button>
      </div>

      <form className="invite-form" onSubmit={submit}>
        <label>
          <span>Nombre completo</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            minLength={2}
            required
          />
        </label>

        <label>
          <span>Correo institucional</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label>
          <span>Rol</span>
          <select
            value={role}
            onChange={(event) => changeRole(event.target.value as AppRole)}
          >
            <option value="consulta">Consulta</option>
            <option value="editor">Editor</option>
            <option value="administrador">Administrador</option>
          </select>
        </label>

        <fieldset>
          <legend>Secciones permitidas</legend>

          {role === "administrador" ? (
            <AdminAccessNote />
          ) : (
            <div className="permission-grid">
              {sections.map((section) => (
                <label key={section.id} className="permission-option">
                  <input
                    type="checkbox"
                    checked={sectionIds.includes(section.id)}
                    onChange={() =>
                      setSectionIds((current) =>
                        current.includes(section.id)
                          ? current.filter((id) => id !== section.id)
                          : [...current, section.id],
                      )
                    }
                  />
                  <span>
                    <strong>{section.title}</strong>
                    <small>{isSectionAvailable(section) ? "Disponible" : "Próximamente"}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        {error && <div className="form-error">{error}</div>}

        <button className="primary-button" disabled={saving}>
          {saving ? "Creando…" : "Crear y enviar invitación"}
        </button>
      </form>
    </section>
  );
}

function UserEditor({
  user,
  sections,
  initialSections,
  isCurrent,
  onSave,
  onDelete,
}: {
  user: UserRecord;
  sections: SectionRecord[];
  initialSections: string[];
  isCurrent: boolean;
  onSave: (body: {
    userId: string;
    fullName: string;
    role: AppRole;
    status: "activo" | "inactivo";
    sectionIds: string[];
  }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [sectionIds, setSectionIds] = useState(initialSections);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 7_000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const effectiveSectionIds = role === "administrador" ? [] : sectionIds;
  const effectiveSectionKey = [...effectiveSectionIds].sort().join();
  const initialSectionKey =
    user.role === "administrador" ? "" : [...initialSections].sort().join();

  const changed = useMemo(
    () =>
      fullName !== user.full_name ||
      role !== user.role ||
      status !== user.status ||
      effectiveSectionKey !== initialSectionKey,
    [
      fullName,
      role,
      status,
      effectiveSectionKey,
      initialSectionKey,
      user.full_name,
      user.role,
      user.status,
    ],
  );

  useEffect(() => {
    if (editing) return;
    setFullName(user.full_name);
    setRole(user.role);
    setStatus(user.status);
    setSectionIds(initialSections);
    setError("");
  }, [editing, user.full_name, user.role, user.status, initialSections]);

  function changeRole(nextRole: AppRole) {
    setRole(nextRole);
    if (nextRole === "administrador") setSectionIds([]);
  }

  function cancelEditing() {
    setFullName(user.full_name);
    setRole(user.role);
    setStatus(user.status);
    setSectionIds(initialSections);
    setError("");
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    setError("");

    try {
      await onSave({
        userId: user.id,
        fullName,
        role,
        status,
        sectionIds: effectiveSectionIds,
      });
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setDeleting(true);
    setError("");

    try {
      await onDelete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible eliminar el acceso.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article className={`user-row ${editing ? "editing" : ""}`}>
      <div className="avatar user-avatar">{initials(user.full_name)}</div>

      <div className="user-primary">
        {editing ? (
          <label className="user-name-control">
            <span>Nombre completo</span>
            <input
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </label>
        ) : (
          <>
            <strong>
              {user.full_name}
              {isCurrent && <em>Tú</em>}
            </strong>
            <span>{user.email}</span>
          </>
        )}
      </div>

      {editing ? (
        <>
          <div className="user-edit-fields">
            <label className="user-edit-control">
              <span>Rol</span>
              <select
                value={role}
                disabled={isCurrent}
                onChange={(event) => changeRole(event.target.value as AppRole)}
              >
                <option value="consulta">Consulta</option>
                <option value="editor">Editor</option>
                <option value="administrador">Administrador</option>
              </select>
            </label>

            <label className="user-edit-control">
              <span>Estatus</span>
              <select
                value={status}
                disabled={isCurrent}
                onChange={(event) =>
                  setStatus(event.target.value as "activo" | "inactivo")
                }
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
              </select>
            </label>
          </div>

          <div
            className={`user-permissions ${role === "administrador" ? "admin-mode" : ""}`}
          >
            {role === "administrador" ? (
              <AdminAccessNote compact />
            ) : (
              sections.map((section) => (
                <label key={section.id}>
                  <input
                    type="checkbox"
                    checked={sectionIds.includes(section.id)}
                    onChange={() =>
                      setSectionIds((current) =>
                        current.includes(section.id)
                          ? current.filter((id) => id !== section.id)
                          : [...current, section.id],
                      )
                    }
                  />{" "}
                  {section.title}
                </label>
              ))
            )}
          </div>

          <div className="user-editor-actions">
            <button
              className="primary-button small-button"
              disabled={saving || deleting || !changed}
              onClick={save}
            >
              <Save size={14} /> {saving ? "Guardando" : "Guardar"}
            </button>

            <button
              className="text-button"
              disabled={saving || deleting}
              onClick={cancelEditing}
            >
              Cancelar
            </button>

            {!isCurrent && (
              <button
                className="danger-button small-button"
                disabled={saving || deleting}
                onClick={remove}
              >
                <Trash2 size={14} /> {deleting ? "Eliminando" : "Eliminar"}
              </button>
            )}
          </div>

          {error && <div className="form-error user-editor-error">{error}</div>}
        </>
      ) : (
        <>
          <div className="user-meta">
            <span className={`role-badge role-${user.role}`}>{roleLabel(user.role)}</span>
            <span className={`status-badge status-${user.status}`}>
              {user.status === "activo" ? "Activo" : "Inactivo"}
            </span>
            <span className="section-count">
              {user.role === "administrador" ? sections.length : initialSections.length} tableros
            </span>
          </div>

          <div className="user-row-actions">
            <button className="secondary-button" onClick={() => setEditing(true)}>
              <UserRoundCog size={15} /> Administrar
            </button>

            {!isCurrent && (
              <button className="danger-button" onClick={remove} disabled={deleting}>
                <Trash2 size={15} /> {deleting ? "Eliminando" : "Eliminar"}
              </button>
            )}
          </div>
        </>
      )}
    </article>
  );
}

function AdminAccessNote({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`admin-access-note ${compact ? "compact" : ""}`}>
      <Shield size={compact ? 16 : 19} />
      <span>
        <strong>Acceso total</strong>
      </span>
    </div>
  );
}

function roleLabel(role: AppRole) {
  return role === "administrador"
    ? "Administrador"
    : role === "editor"
      ? "Editor"
      : "Consulta";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
