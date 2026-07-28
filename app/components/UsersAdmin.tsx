"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, MailPlus, RefreshCw, Save, Shield, UserRoundCog, Users } from "lucide-react";
import type { AppRole } from "../../lib/session";

type UserRecord = {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  status: "activo" | "inactivo";
  created_at: string;
};
type SectionRecord = { id: string; slug: string; title: string; availability: string; is_active: boolean };
type PermissionRecord = { user_id: string; section_id: string; can_view: boolean };
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

function isSectionAvailable(section: SectionRecord) {
  return section.availability === "disponible" || section.slug === "dashboard-2";
}

export function UsersAdmin({ csrfToken, currentUserId }: { csrfToken: string; currentUserId: string }) {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [now, setNow] = useState(0);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const payload = (await response.json()) as AdminPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar los usuarios.");
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

  async function mutate(method: "POST" | "PATCH", body: unknown) {
    const response = await fetch("/api/admin/users", {
      method,
      headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as {
      error?: string;
      warning?: string;
      manualInviteUrl?: string;
      delivered?: boolean;
    };
    if (!response.ok) {
      if (payload.manualInviteUrl) setManualUrl(payload.manualInviteUrl);
      throw new Error(payload.error ?? "No fue posible guardar el cambio.");
    }
    if (payload.manualInviteUrl) setManualUrl(payload.manualInviteUrl);
    return payload;
  }

  async function invite(input: { email: string; fullName: string; role: AppRole; sectionIds: string[] }) {
    setError("");
    setNotice("");
    const payload = await mutate("POST", { action: "invite", ...input });
    setNotice(
      payload.delivered
        ? "Invitación enviada correctamente."
        : payload.warning ?? "Invitación creada. Falta configurar el servicio de correo; puedes copiar el enlace temporal.",
    );
    setShowInvite(false);
    await load();
  }

  async function resend(invitationId: string) {
    setError("");
    try {
      const payload = await mutate("POST", { action: "resend", invitationId });
      setNotice(
        payload.delivered
          ? "Invitación reenviada; el enlace anterior quedó invalidado."
          : payload.warning ?? "Se generó un enlace nuevo de 48 horas.",
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible reenviar la invitación.");
    }
  }

  const pending = data?.invitations.filter((invitation) => invitation.status !== "aceptada" && invitation.status !== "revocada") ?? [];

  return (
    <div className="dashboard-stack">
      <header className="content-heading admin-heading">
        <div><p className="eyebrow">Administración</p><h1>Usuarios y permisos</h1><p>Invita personas y controla exactamente qué tableros pueden consultar.</p></div>
        <button className="primary-button" onClick={() => setShowInvite(true)}><MailPlus size={17} /> Nuevo usuario</button>
      </header>

      <section className="admin-stats">
        <div><i><Users size={20} /></i><span><strong>{data?.users.length ?? 0}</strong> Usuarios registrados</span></div>
        <div><i><Shield size={20} /></i><span><strong>{data?.users.filter((user) => user.role === "administrador").length ?? 0}</strong> Administradores</span></div>
        <div><i><MailPlus size={20} /></i><span><strong>{pending.length}</strong> Invitaciones pendientes</span></div>
      </section>

      {notice && <div className="form-success"><Check size={17} /> {notice}</div>}
      {error && <div className="form-error" role="alert">{error}</div>}
      {manualUrl && <div className="manual-link"><div><strong>Enlace temporal</strong><span>Úsalo solamente mientras se configura el proveedor de correo.</span></div><code>{manualUrl}</code><button className="secondary-button" onClick={() => navigator.clipboard.writeText(manualUrl)}><Copy size={15} /> Copiar</button></div>}

      {showInvite && data && <InviteForm sections={data.sections} onCancel={() => setShowInvite(false)} onSubmit={invite} />}

      <section className="surface user-list-card">
        <div className="card-heading"><div><p className="eyebrow">Directorio</p><h2>Usuarios activos e inactivos</h2></div>{loading && <span>Actualizando…</span>}</div>
        <div className="user-list">
          {data?.users.map((user) => (
            <UserEditor
              key={user.id}
              user={user}
              sections={data.sections}
              initialSections={data.permissions.filter((permission) => permission.user_id === user.id && permission.can_view).map((permission) => permission.section_id)}
              isCurrent={user.id === currentUserId}
              onSave={async (body) => { await mutate("PATCH", body); setNotice("Permisos actualizados."); await load(); }}
            />
          ))}
          {!loading && !data?.users.length && <div className="empty-table">No hay usuarios registrados.</div>}
        </div>
      </section>

      <section className="surface invitations-card">
        <div className="card-heading"><div><p className="eyebrow">Seguimiento</p><h2>Invitaciones</h2></div></div>
        <div className="invitation-list">
          {pending.map((invitation) => {
            const expired = now > new Date(invitation.expires_at).getTime();
            return <div key={invitation.id} className="invitation-row"><div className="avatar small">{initials(invitation.full_name)}</div><div><strong>{invitation.full_name}</strong><span>{invitation.email}</span></div><span className={`status-badge ${expired ? "status-expired" : "status-pending"}`}>{expired ? "Vencida" : "Pendiente"}</span><span className="invite-date">Vence {new Date(invitation.expires_at).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span><button className="secondary-button" onClick={() => resend(invitation.id)}><RefreshCw size={14} /> Reenviar</button></div>;
          })}
          {!pending.length && <div className="empty-table">No hay invitaciones pendientes.</div>}
        </div>
      </section>
    </div>
  );
}

function InviteForm({ sections, onCancel, onSubmit }: { sections: SectionRecord[]; onCancel: () => void; onSubmit: (input: { email: string; fullName: string; role: AppRole; sectionIds: string[] }) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("consulta");
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSubmit({ email, fullName, role, sectionIds });
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

  return <section className="surface invite-form-card"><div className="card-heading"><div><p className="eyebrow">Acceso nuevo</p><h2>Invitar usuario</h2></div><button className="text-button" onClick={onCancel}>Cancelar</button></div><form className="invite-form" onSubmit={submit}><label><span>Nombre completo</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} required /></label><label><span>Correo institucional</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label><span>Rol</span><select value={role} onChange={(event) => setRole(event.target.value as AppRole)}><option value="consulta">Consulta</option><option value="editor">Editor</option><option value="administrador">Administrador</option></select></label><fieldset><legend>Secciones permitidas</legend><div className="permission-grid">{sections.map((section) => <label key={section.id} className="permission-option"><input type="checkbox" checked={sectionIds.includes(section.id)} onChange={() => setSectionIds((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])} /><span><strong>{section.title}</strong><small>{isSectionAvailable(section) ? "Disponible" : "Próximamente"}</small></span></label>)}</div></fieldset>{error && <div className="form-error">{error}</div>}<button className="primary-button" disabled={saving}>{saving ? "Creando…" : "Crear y enviar invitación"}</button></form></section>;
}

function UserEditor({ user, sections, initialSections, isCurrent, onSave }: { user: UserRecord; sections: SectionRecord[]; initialSections: string[]; isCurrent: boolean; onSave: (body: { userId: string; fullName: string; role: AppRole; status: "activo" | "inactivo"; sectionIds: string[] }) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(user.full_name);
  const [role, setRole] = useState(user.role);
  const [status, setStatus] = useState(user.status);
  const [sectionIds, setSectionIds] = useState(initialSections);
  const [saving, setSaving] = useState(false);
  const changed = useMemo(() => fullName !== user.full_name || role !== user.role || status !== user.status || [...sectionIds].sort().join() !== [...initialSections].sort().join(), [fullName, role, status, sectionIds, user, initialSections]);

  useEffect(() => {
    if (editing) return;
    setFullName(user.full_name);
    setRole(user.role);
    setStatus(user.status);
    setSectionIds(initialSections);
  }, [editing, user.full_name, user.role, user.status, initialSections]);

  function cancelEditing() {
    setFullName(user.full_name);
    setRole(user.role);
    setStatus(user.status);
    setSectionIds(initialSections);
    setEditing(false);
  }

  async function save() {
    setSaving(true);
    try { await onSave({ userId: user.id, fullName, role, status, sectionIds }); setEditing(false); }
    finally { setSaving(false); }
  }

  return <article className={`user-row ${editing ? "editing" : ""}`}><div className="avatar">{initials(user.full_name)}</div><div className="user-primary">{editing ? <input value={fullName} onChange={(event) => setFullName(event.target.value)} /> : <><strong>{user.full_name}{isCurrent && <em>Tú</em>}</strong><span>{user.email}</span></>}</div>{editing ? <><select value={role} disabled={isCurrent} onChange={(event) => setRole(event.target.value as AppRole)}><option value="consulta">Consulta</option><option value="editor">Editor</option><option value="administrador">Administrador</option></select><select value={status} disabled={isCurrent} onChange={(event) => setStatus(event.target.value as "activo" | "inactivo")}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select><div className="user-permissions">{sections.map((section) => <label key={section.id}><input type="checkbox" checked={sectionIds.includes(section.id)} onChange={() => setSectionIds((current) => current.includes(section.id) ? current.filter((id) => id !== section.id) : [...current, section.id])} /> {section.title}</label>)}</div><button className="primary-button small-button" disabled={saving || !changed} onClick={save}><Save size={14} /> {saving ? "Guardando" : "Guardar"}</button><button className="text-button" onClick={cancelEditing}>Cancelar</button></> : <><span className={`role-badge role-${user.role}`}>{roleLabel(user.role)}</span><span className={`status-badge status-${user.status}`}>{user.status === "activo" ? "Activo" : "Inactivo"}</span><span className="section-count">{initialSections.length || (user.role === "administrador" ? sections.length : 0)} tableros</span><button className="secondary-button" onClick={() => setEditing(true)}><UserRoundCog size={15} /> Administrar</button></>}</article>;
}

function roleLabel(role: AppRole) {
  return role === "administrador" ? "Administrador" : role === "editor" ? "Editor" : "Consulta";
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}
