"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";

export function LoginScreen({ onAuthenticated }: { onAuthenticated: () => Promise<void> }) {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      if (mode === "forgot") {
        const response = await fetch("/api/auth/request-password-reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json()) as { error?: string; message?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "No fue posible solicitar el restablecimiento.");
        }
        setNotice(
          payload.message ??
            "Si existe una cuenta activa con ese correo, recibirás instrucciones para restablecer la contraseña.",
        );
        return;
      }

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible iniciar sesión.");
      }
      await onAuthenticated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible completar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  function showForgotPassword() {
    setMode("forgot");
    setError("");
    setNotice("");
  }

  function showLogin() {
    setMode("login");
    setError("");
    setNotice("");
  }

  return (
    <main className="login-page" aria-label="Acceso a Movilidad y Transporte">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-brand">
          <Image
            className="login-logo"
            src="/logo-morelos-tym.png"
            alt="Gobierno del Estado de Morelos"
            width={693}
            height={160}
            priority
          />
        </header>

        <div className="login-heading">
          <h1 id="login-title">
            {mode === "login" ? "Bienvenido/a" : "Restablece tu contraseña"}
          </h1>
          <p>
            {mode === "login"
              ? "Al sistema de consulta de información de trámites, refrendos y experiencia ciudadana NPS."
              : "Escribe tu correo institucional y te enviaremos un enlace de recuperación."}
          </p>
        </div>

        <form onSubmit={submit} className="login-form" noValidate>
          <label className="auth-field">
            <span>Correo electrónico</span>
            <div className="auth-input-shell">
              <Mail className="auth-input-icon" size={18} aria-hidden="true" />
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@morelos.gob.mx"
                required
              />
            </div>
          </label>

          {mode === "login" && (
            <label className="auth-field">
              <span>Contraseña</span>
              <div className="password-field">
                <LockKeyhole className="auth-input-icon" size={18} aria-hidden="true" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Ingresa tu contraseña"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
          )}

          {mode === "login" ? (
            <button className="login-help-link" type="button" onClick={showForgotPassword}>
              ¿Olvidaste tu contraseña?
            </button>
          ) : (
            <button className="login-help-link login-back-link" type="button" onClick={showLogin}>
              <ArrowLeft size={15} /> Volver al inicio de sesión
            </button>
          )}

          {notice && (
            <div className="form-success" role="status">
              <CheckCircle2 size={17} /> {notice}
            </div>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button login-submit" disabled={loading || Boolean(notice)}>
            {loading
              ? "Procesando…"
              : mode === "login"
                ? "Iniciar sesión"
                : notice
                  ? "Solicitud preparada"
                  : "Enviar enlace de recuperación"}
          </button>
        </form>
      </section>
    </main>
  );
}
