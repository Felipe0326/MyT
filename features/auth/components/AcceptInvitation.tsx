"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";

export function AcceptInvitation({ token, onFinished }: { token: string; onFinished: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible activar la cuenta.");
      }
      setSuccess(true);
      window.history.replaceState({}, "", "/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible activar la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="invite-page invite-password-page" aria-label="Activación de cuenta">
      <section className="invite-card invite-password-card" aria-labelledby="invite-title">
        <header className="invite-brand">
          <Image
            className="invite-logo"
            src="/logo-morelos-tym.png"
            alt="Gobierno del Estado de Morelos"
            width={693}
            height={160}
            priority
          />
        </header>

        {success ? (
          <div className="invite-success">
            <CheckCircle2 size={52} aria-hidden="true" />
            <p className="eyebrow">Cuenta activada</p>
            <h1 id="invite-title">Tu acceso está listo</h1>
            <p>Ya puedes iniciar sesión con la contraseña que acabas de establecer.</p>
            <button className="primary-button login-submit invite-submit" onClick={onFinished}>
              Ir al inicio de sesión
            </button>
          </div>
        ) : (
          <>
            <div className="invite-heading">
              <p className="eyebrow">Invitación personal</p>
              <h1 id="invite-title">Crea tu contraseña</h1>
              <p id="invite-password-help">
                Debe contener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.
              </p>
            </div>

            <form onSubmit={submit} className="login-form invite-password-form" noValidate>
              <label className="auth-field">
                <span>Nueva contraseña</span>
                <div className="password-field">
                  <LockKeyhole className="auth-input-icon" size={18} aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    aria-describedby="invite-password-help"
                    placeholder="Ingresa tu contraseña"
                    minLength={12}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="auth-field">
                <span>Confirmar contraseña</span>
                <div className="password-field">
                  <LockKeyhole className="auth-input-icon" size={18} aria-hidden="true" />
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Confirma tu contraseña"
                    minLength={12}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirm((value) => !value)}
                    aria-label={showConfirm ? "Ocultar confirmación" : "Mostrar confirmación"}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {error && (
                <div className="form-error" role="alert">
                  {error}
                </div>
              )}

              <button className="primary-button login-submit invite-submit" disabled={loading}>
                {loading ? "Activando…" : "Activar cuenta"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
