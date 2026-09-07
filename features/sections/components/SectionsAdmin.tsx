"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  CheckCircle2,
  Code2,
  FileText,
  LayoutDashboard,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { isDashboardRegistered } from "@/features/dashboards/core/client-registry";
import type {
  SectionAdminRecord,
  SectionAvailability,
  SectionIcon,
  SectionsAdminPayload,
} from "@/features/sections/types";

type EditableSection = {
  title: string;
  description: string;
  icon: SectionIcon;
  sortOrder: number;
  availability: SectionAvailability;
  isActive: boolean;
};

type NewSection = EditableSection & { slug: string };

const EMPTY_SECTION: NewSection = {
  slug: "",
  title: "",
  description: "",
  icon: "layout-dashboard",
  sortOrder: 1,
  availability: "proximamente",
  isActive: true,
};

const ICON_OPTIONS: Array<{ value: SectionIcon; label: string }> = [
  { value: "layout-dashboard", label: "Tablero" },
  { value: "activity", label: "Actividad" },
  { value: "refresh-cw", label: "Actualización" },
  { value: "file-text", label: "Documento" },
];

export function SectionsAdmin({
  csrfToken,
  onSectionsChanged,
}: {
  csrfToken: string;
  onSectionsChanged: () => Promise<void>;
}) {
  const [sections, setSections] = useState<SectionAdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newSection, setNewSection] = useState<NewSection>(EMPTY_SECTION);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditableSection | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/sections", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as SectionsAdminPayload & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "No fue posible cargar las secciones.");
      setSections(payload.sections);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cargar las secciones.");
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

  useEffect(() => {
    if (!showCreate && !editingId) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || creating || savingId) return;
      setShowCreate(false);
      setEditingId(null);
      setEditValues(null);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showCreate, editingId, creating, savingId]);

  const stats = useMemo(() => ({
    total: sections.length,
    active: sections.filter((section) => section.is_active).length,
    implemented: sections.filter((section) => section.implemented).length,
    inactive: sections.filter((section) => !section.is_active).length,
  }), [sections]);

  const editingSection = useMemo(
    () => sections.find((section) => section.id === editingId) ?? null,
    [sections, editingId],
  );

  function openCreate() {
    setNewSection({ ...EMPTY_SECTION, sortOrder: sections.length + 1 });
    setShowCreate(true);
    setEditingId(null);
    setEditValues(null);
    setError("");
  }

  function changeNewTitle(title: string) {
    setNewSection((current) => {
      const currentAutoSlug = slugFromTitle(current.title);
      const shouldUpdateSlug = !current.slug || current.slug === currentAutoSlug;
      const nextSlug = shouldUpdateSlug ? slugFromTitle(title) : current.slug;
      return {
        ...current,
        title,
        slug: nextSlug,
        availability: isDashboardRegistered(nextSlug) ? current.availability : "proximamente",
      };
    });
  }

  function changeNewSlug(slug: string) {
    const normalized = normalizeSlugInput(slug);
    setNewSection((current) => ({
      ...current,
      slug: normalized,
      availability: isDashboardRegistered(normalized) ? current.availability : "proximamente",
    }));
  }

  async function mutate(method: "POST" | "PATCH" | "DELETE", body: unknown) {
    const response = await fetch("/api/admin/sections", {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { error?: string; section?: SectionAdminRecord; ok?: boolean };
    if (!response.ok) throw new Error(payload.error ?? "No fue posible guardar el cambio.");
    return payload;
  }

  async function createSection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError("");
    setNotice("");
    try {
      await mutate("POST", newSection);
      await load();
      await onSectionsChanged();
      setShowCreate(false);
      setNotice("Sección creada correctamente en Supabase.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible crear la sección.");
    } finally {
      setCreating(false);
    }
  }

  function beginEdit(section: SectionAdminRecord) {
    setShowCreate(false);
    setEditingId(section.id);
    setEditValues({
      title: section.title,
      description: section.description,
      icon: section.icon,
      sortOrder: section.sort_order,
      availability: section.implemented ? section.availability : "proximamente",
      isActive: section.is_active,
    });
    setError("");
  }

  async function saveEdit(section: SectionAdminRecord, event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!editValues || savingId) return;
    setSavingId(section.id);
    setError("");
    setNotice("");
    try {
      await mutate("PATCH", { id: section.id, ...editValues });
      await load();
      await onSectionsChanged();
      setEditingId(null);
      setEditValues(null);
      setNotice("Sección actualizada correctamente.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible actualizar la sección.");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(section: SectionAdminRecord) {
    if (savingId) return;
    setSavingId(section.id);
    setError("");
    setNotice("");
    try {
      if (section.is_active) {
        await mutate("DELETE", { id: section.id });
        setNotice("Sección desactivada. Ya no aparecerá en el portal.");
      } else {
        await mutate("PATCH", {
          id: section.id,
          title: section.title,
          description: section.description,
          icon: section.icon,
          sortOrder: section.sort_order,
          availability: section.implemented ? section.availability : "proximamente",
          isActive: true,
        });
        setNotice("Sección reactivada correctamente.");
      }
      await load();
      await onSectionsChanged();
      if (editingId === section.id) {
        setEditingId(null);
        setEditValues(null);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cambiar el estado de la sección.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="sections-admin page-shell">
      <header className="admin-module-header surface">
        <div className="admin-module-title">
          <i><LayoutDashboard size={23} /></i>
          <div>
            <p className="eyebrow">Administración</p>
            <h1>Secciones</h1>
            <p>Crea y organiza los módulos visibles en el portal.</p>
          </div>
        </div>
        <button className="primary-button admin-header-action" type="button" onClick={openCreate}>
          <Plus size={17} /> Nueva sección
        </button>
      </header>

      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="form-success" role="status">{notice}</div>}

      <section className="admin-stats sections-stats" aria-label="Resumen de secciones">
        <div><i><LayoutDashboard size={19} /></i><span>Total<strong>{stats.total}</strong></span></div>
        <div><i><Power size={19} /></i><span>Activas<strong>{stats.active}</strong></span></div>
        <div><i><Code2 size={19} /></i><span>Implementadas<strong>{stats.implemented}</strong></span></div>
        <div><i><PowerOff size={19} /></i><span>Inactivas<strong>{stats.inactive}</strong></span></div>
      </section>

      <section className="surface sections-list-card">
        <div className="section-list-heading">
          <div><p className="eyebrow">Catálogo</p><h2>Secciones del portal</h2></div>
          <span>{sections.length} registros</span>
        </div>

        {loading ? (
          <div className="sections-empty">Cargando secciones…</div>
        ) : sections.length === 0 ? (
          <div className="sections-empty">No hay secciones registradas.</div>
        ) : (
          <div className="sections-list">
            {sections.map((section) => (
              <article key={section.id} className={`section-admin-row ${!section.is_active ? "inactive" : ""}`}>
                <div className="section-admin-main">
                  <div className="section-admin-identity">
                    <SectionIconView icon={section.icon} />
                    <div>
                      <strong>{section.title}</strong>
                      <code>{section.slug}</code>
                      <small>{section.description || "Sin descripción"}</small>
                    </div>
                  </div>
                  <div className="section-admin-meta">
                    <span className={`implementation-badge ${section.implemented ? "ready" : "pending"}`}>
                      {section.implemented ? <CheckCircle2 size={14} /> : <Code2 size={14} />}
                      {section.implemented ? "Implementado" : "Pendiente de código"}
                    </span>
                    <span className={`status-badge ${section.availability === "disponible" ? "status-activo" : "status-pending"}`}>
                      {section.availability === "disponible" ? "Disponible" : "Próximamente"}
                    </span>
                    <span className={`status-badge ${section.is_active ? "status-activo" : "status-inactivo"}`}>
                      {section.is_active ? "Activa" : "Inactiva"}
                    </span>
                    <span className="section-order">Orden {section.sort_order}</span>
                  </div>
                </div>
                <div className="section-row-actions">
                  <button className="secondary-button compact" type="button" onClick={() => beginEdit(section)}><Pencil size={15} /> Editar</button>
                  <button className="secondary-button compact" type="button" disabled={savingId === section.id} onClick={() => void toggleActive(section)}>
                    {section.is_active ? <PowerOff size={15} /> : <Power size={15} />}
                    {section.is_active ? "Desactivar" : "Reactivar"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showCreate && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) setShowCreate(false);
          }}
        >
          <form className="admin-modal-dialog admin-section-modal" role="dialog" aria-modal="true" aria-labelledby="create-section-title" onSubmit={createSection}>
            <div className="admin-modal-header">
              <div>
                <p className="eyebrow">Nueva sección</p>
                <h2 id="create-section-title">Registrar sección</h2>
                <p>Se guardará directamente en Supabase y aparecerá en el portal según su estado.</p>
              </div>
              <button className="icon-button" type="button" disabled={creating} onClick={() => setShowCreate(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <SectionFields
              value={newSection}
              slug={newSection.slug}
              slugEditable
              implemented={isDashboardRegistered(newSection.slug)}
              maxOrder={sections.length + 1}
              onChange={(patch) => setNewSection((current) => ({ ...current, ...patch }))}
              onTitleChange={changeNewTitle}
              onSlugChange={changeNewSlug}
            />
            <div className="admin-modal-actions">
              <button className="secondary-button" type="button" disabled={creating} onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="primary-button" type="submit" disabled={creating}>{creating ? "Guardando…" : "Crear sección"}</button>
            </div>
          </form>
        </div>
      )}

      {editingSection && editValues && (
        <div
          className="admin-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && savingId !== editingSection.id) {
              setEditingId(null);
              setEditValues(null);
            }
          }}
        >
          <form className="admin-modal-dialog admin-section-modal" role="dialog" aria-modal="true" aria-labelledby="edit-section-title" onSubmit={(event) => void saveEdit(editingSection, event)}>
            <div className="admin-modal-header">
              <div className="section-admin-identity modal-identity">
                <SectionIconView icon={editingSection.icon} />
                <div>
                  <p className="eyebrow">Editar sección</p>
                  <h2 id="edit-section-title">{editingSection.title}</h2>
                  <code>{editingSection.slug}</code>
                </div>
              </div>
              <button className="icon-button" type="button" disabled={savingId === editingSection.id} onClick={() => { setEditingId(null); setEditValues(null); }} aria-label="Cerrar"><X size={18} /></button>
            </div>
            <SectionFields
              value={editValues}
              slug={editingSection.slug}
              slugEditable={false}
              implemented={editingSection.implemented}
              maxOrder={sections.length}
              onChange={(patch) => setEditValues((current) => current ? { ...current, ...patch } : current)}
            />
            <div className="admin-modal-actions">
              <button className="secondary-button" type="button" disabled={savingId === editingSection.id} onClick={() => { setEditingId(null); setEditValues(null); }}><X size={15} /> Cancelar</button>
              <button className="primary-button" type="submit" disabled={savingId === editingSection.id}><Save size={15} /> {savingId === editingSection.id ? "Guardando…" : "Guardar cambios"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function SectionFields({
  value,
  slug,
  slugEditable,
  implemented,
  maxOrder,
  onChange,
  onTitleChange,
  onSlugChange,
}: {
  value: EditableSection;
  slug: string;
  slugEditable: boolean;
  implemented: boolean;
  maxOrder: number;
  onChange: (patch: Partial<EditableSection>) => void;
  onTitleChange?: (value: string) => void;
  onSlugChange?: (value: string) => void;
}) {
  return (
    <div className="section-fields">
      <label>
        <span>Nombre</span>
        <input
          required
          minLength={2}
          maxLength={100}
          value={value.title}
          onChange={(event) => onTitleChange ? onTitleChange(event.target.value) : onChange({ title: event.target.value })}
          placeholder="Ej. Infracciones"
        />
      </label>
      <label>
        <span>Slug</span>
        <input
          required
          value={slug}
          disabled={!slugEditable}
          onChange={(event) => onSlugChange?.(event.target.value)}
          pattern="dashboard-[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="dashboard-infracciones"
        />
        <small>{slugEditable ? "Se genera a partir del nombre y queda fijo después de crear la sección." : "El slug es permanente para proteger permisos y relaciones."}</small>
      </label>
      <label className="section-description-field">
        <span>Descripción</span>
        <textarea
          maxLength={500}
          rows={3}
          value={value.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Describe brevemente qué mostrará este tablero."
        />
      </label>
      <label>
        <span>Ícono</span>
        <select value={value.icon} onChange={(event) => onChange({ icon: event.target.value as SectionIcon })}>
          {ICON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label>
        <span>Orden</span>
        <input required type="number" min={1} max={Math.max(1, maxOrder)} step={1} value={value.sortOrder} onChange={(event) => onChange({ sortOrder: Number(event.target.value) })} />
        <small>Usa 1, 2, 3… para definir la posición en el menú.</small>
      </label>
      <label>
        <span>Disponibilidad</span>
        <select
          value={value.availability}
          onChange={(event) => onChange({ availability: event.target.value as SectionAvailability })}
        >
          <option value="proximamente">Próximamente</option>
          <option value="disponible" disabled={!implemented}>Disponible</option>
        </select>
        <small>{implemented ? "El módulo existe en el código y puede publicarse." : "Disponible se habilita cuando exista un módulo registrado con este slug."}</small>
      </label>
      <label className="section-active-field">
        <span>Estado</span>
        <span className="section-active-toggle">
          <input type="checkbox" checked={value.isActive} onChange={(event) => onChange({ isActive: event.target.checked })} />
          <strong>Sección activa</strong>
        </span>
        <small>Las secciones inactivas no aparecen en el portal ni pueden abrirse.</small>
      </label>
    </div>
  );
}

function SectionIconView({ icon }: { icon: SectionIcon }) {
  if (icon === "activity") return <i className="section-icon-preview"><Activity size={19} /></i>;
  if (icon === "refresh-cw") return <i className="section-icon-preview"><RefreshCw size={19} /></i>;
  if (icon === "file-text") return <i className="section-icon-preview"><FileText size={19} /></i>;
  return <i className="section-icon-preview"><LayoutDashboard size={19} /></i>;
}

function slugFromTitle(value: string) {
  const suffix = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return suffix ? `dashboard-${suffix}` : "";
}

function normalizeSlugInput(value: string) {
  let normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+/g, "");
  if (normalized && !normalized.startsWith("dashboard-")) {
    normalized = `dashboard-${normalized.replace(/^dashboard-?/, "")}`;
  }
  return normalized.slice(0, 80);
}
