"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Save, Shield, Trash2, UserRoundCog } from "lucide-react";
import type { AppRole } from "@/lib/session";
import { initials, isSectionAvailable, roleLabel } from "@/features/users/lib/display";
import type { SectionRecord, UserRecord } from "@/features/users/types";

export function InviteForm({
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

export function UserEditor({
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
