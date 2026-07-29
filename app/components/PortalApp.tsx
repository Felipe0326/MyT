"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ChevronUp,
  Clock3,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PanelsTopLeft,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { AppSection } from "../../lib/session";
import type { SessionData } from "../types";
import { AcceptInvitation } from "./AcceptInvitation";
import { LoginScreen } from "./LoginScreen";
import { NpsDashboard } from "./NpsDashboard";
import { RefrendosDashboard } from "./refrendos/RefrendosDashboard";
import { ResetPassword } from "./ResetPassword";
import { UsersAdmin } from "./UsersAdmin";

export function PortalApp() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [checking, setChecking] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [idleWarning, setIdleWarning] = useState(false);
  const lastActivity = useRef(0);

  const loadSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setSession(null);
        return;
      }

      const payload = (await response.json()) as SessionData | { authenticated: false };
      setSession(payload.authenticated ? payload : null);
    } finally {
      setChecking(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (session?.csrfToken) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "x-csrf-token": session.csrfToken },
        keepalive: true,
      }).catch(() => undefined);
    }
    setSession(null);
    setIdleWarning(false);
  }, [session]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const invite = params.get("invite");
      const reset = params.get("reset");
      if (invite) {
        setInviteToken(invite);
        setChecking(false);
      } else if (reset) {
        setResetToken(reset);
        setChecking(false);
      } else {
        void loadSession();
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    lastActivity.current = Date.now();
    const markActive = () => {
      lastActivity.current = Date.now();
      setIdleWarning(false);
    };
    const events = ["pointerdown", "keydown", "touchstart", "focus"] as const;
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    const idleCheck = window.setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= 30 * 60 * 1000) void logout();
      else setIdleWarning(idle >= 25 * 60 * 1000);
    }, 30_000);
    const refresh = window.setInterval(() => {
      if (Date.now() - lastActivity.current < 30 * 60 * 1000) void loadSession();
    }, 10 * 60 * 1000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, markActive));
      window.clearInterval(idleCheck);
      window.clearInterval(refresh);
    };
  }, [session, loadSession, logout]);

  if (checking) return (
    <div className="app-loading" role="status" aria-live="polite">
      <div className="loading-brand">
        <Image
          src="/logo-morelos-tym.png"
          alt="Gobierno del Estado de Morelos"
          width={659}
          height={156}
          priority
        />
      </div>
      <span>Protegiendo tu acceso…</span>
    </div>
  );
  if (inviteToken) return <AcceptInvitation token={inviteToken} onFinished={() => setInviteToken(null)} />;
  if (resetToken) return <ResetPassword token={resetToken} onFinished={() => setResetToken(null)} />;
  if (!session) return <LoginScreen onAuthenticated={loadSession} />;

  return <ApplicationShell session={session} idleWarning={idleWarning} onLogout={logout} />;
}

function ApplicationShell({ session, idleWarning, onLogout }: { session: SessionData; idleWarning: boolean; onLogout: () => Promise<void> }) {
  const firstSection = session.sections.find((section) => section.availability === "disponible" || section.slug === "dashboard-2")?.slug ?? session.sections[0]?.slug ?? "empty";
  const [active, setActive] = useState(firstSection);
  const [visitedDashboards, setVisitedDashboards] = useState<string[]>(
    firstSection === "dashboard-nps" || firstSection === "dashboard-2" ? [firstSection] : [],
  );
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const activeSection = session.sections.find((section) => section.slug === active);

  useEffect(() => {
    if (!profileOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [profileOpen]);

  function selectSection(slug: string) {
    if (slug === "dashboard-nps" || slug === "dashboard-2") {
      setVisitedDashboards((current) => current.includes(slug) ? current : [...current, slug]);
    }
    setActive(slug);
    setMobileOpen(false);
    setProfileOpen(false);
  }

  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      {mobileOpen && <button className="sidebar-scrim" aria-label="Cerrar navegación" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-institutional-logo sidebar-logo-top">
            <Image src="/logo-morelos-tym.png" alt="Gobierno del Estado de Morelos" width={693} height={160} priority />
          </div>
          <button className="desktop-collapse" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expandir menú" : "Contraer menú"}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
          <button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú"><X size={20} /></button>
        </div>

        <nav className="sidebar-nav" aria-label="Navegación principal">
          <p>Secciones</p>
          {session.sections.map((section) => (
            <button key={section.id} className={active === section.slug ? "active" : ""} onClick={() => selectSection(section.slug)} title={collapsed ? section.title : undefined}>
              <i>{sectionIcon(section)}</i><span>{section.title}</span>{section.availability === "proximamente" && section.slug !== "dashboard-2" && <em>Próximo</em>}
            </button>
          ))}
          {session.user.role === "administrador" && <><p className="management-label">Administración</p><button className={active === "usuarios" ? "active" : ""} onClick={() => selectSection("usuarios")} title={collapsed ? "Usuarios" : undefined}><i><Users size={19} /></i><span>Usuarios</span></button></>}
        </nav>

        <div className="sidebar-footer">
          <button className="profile-block" onClick={() => setProfileOpen(true)} aria-expanded={profileOpen} title={collapsed ? session.user.fullName : undefined}>
            <div className="avatar">{initials(session.user.fullName)}</div>
            <div><strong>{session.user.fullName}</strong><span>{roleLabel(session.user.role)}</span></div>
            <ChevronUp className="profile-chevron" size={16} />
          </button>
        </div>
      </aside>

      {profileOpen && (
        <div className="profile-modal-backdrop" onMouseDown={() => setProfileOpen(false)}>
          <div className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="profile-modal-close" type="button" onClick={() => setProfileOpen(false)} aria-label="Cerrar perfil"><X size={20} /></button>
            <div className="profile-modal-head">
              <div className="avatar profile-modal-avatar">{initials(session.user.fullName)}</div>
              <div>
                <p className="eyebrow">Mi perfil</p>
                <h2 id="profile-modal-title">{session.user.fullName}</h2>
                <span>{roleLabel(session.user.role)}</span>
              </div>
            </div>
            <div className="profile-modal-details">
              <div className="profile-detail"><Mail size={17} /><div><small>Correo electrónico</small><span>{session.user.email}</span></div></div>
              <div className="profile-detail"><UserRound size={17} /><div><small>Estado de la cuenta</small><span>Cuenta activa</span></div></div>
            </div>
            <button className="profile-modal-logout" type="button" onClick={() => void onLogout()}><LogOut size={18} /><span>Cerrar sesión</span></button>
          </div>
        </div>
      )}

      <section className="workspace">
        <header className="mobile-header"><button onClick={() => setMobileOpen(true)} aria-label="Abrir menú"><Menu size={22} /></button><div className="mobile-wordmark"><strong>Movilidad</strong><span>y Transporte</span></div><button className="mobile-profile-button" type="button" onClick={() => setProfileOpen(true)} aria-label="Abrir perfil"><div className="avatar small">{initials(session.user.fullName)}</div></button></header>
        {idleWarning && <div className="idle-banner"><Clock3 size={17} /><span>Tu sesión se cerrará pronto por inactividad. Interactúa con la página para continuar.</span></div>}
        <main className={`workspace-content ${active === "dashboard-nps" || active === "dashboard-2" ? "full-bleed" : ""}`}>
          {visitedDashboards.includes("dashboard-nps") && (
            <div hidden={active !== "dashboard-nps"}>
              <NpsDashboard isActive={active === "dashboard-nps"} csrfToken={session.csrfToken} />
            </div>
          )}
          {visitedDashboards.includes("dashboard-2") && (
            <div hidden={active !== "dashboard-2"}>
              <RefrendosDashboard isActive={active === "dashboard-2"} />
            </div>
          )}
          {active === "usuarios" && session.user.role === "administrador" && <UsersAdmin csrfToken={session.csrfToken} currentUserId={session.user.id} />}
          {activeSection?.availability === "proximamente" && active !== "dashboard-2" && <ComingSoon section={activeSection} />}
          {active === "empty" && <EmptyAccess />}
        </main>
      </section>
    </div>
  );
}

function ComingSoon({ section }: { section: AppSection }) {
  return <div className="coming-page"><div className="coming-icon"><PanelsTopLeft size={34} /></div><p className="eyebrow">Módulo preparado</p><h1>{section.title}</h1><p>{section.description}</p><div className="coming-status"><span /><strong>Esperando el tablero para integrarlo</strong></div><small>La autenticación, permisos y navegación ya están listos para este módulo.</small></div>;
}

function EmptyAccess() {
  return <div className="coming-page"><div className="coming-icon"><ShieldCheck size={34} /></div><p className="eyebrow">Acceso limitado</p><h1>Sin secciones asignadas</h1><p>Solicita al administrador que habilite al menos una sección para tu cuenta.</p></div>;
}

function sectionIcon(section: AppSection) {
  if (section.icon === "activity") return <Activity size={19} />;
  if (section.icon === "refresh-cw") return <RefreshCw size={19} />;
  if (section.icon === "file-text") return <FileText size={19} />;
  return <LayoutDashboard size={19} />;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function roleLabel(role: SessionData["user"]["role"]) {
  return role === "administrador" ? "Administrador" : role === "editor" ? "Editor" : "Consulta";
}
