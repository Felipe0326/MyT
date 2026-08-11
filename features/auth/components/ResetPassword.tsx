"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";

export function ResetPassword({ token, onFinished }: { token: string; onFinished: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
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
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "No fue posible cambiar la contraseña.");
      }
      setSuccess(true);
      window.history.replaceState({}, "", "/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No fue posible cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="invite-page">
      <section className="invite-card">
        {success ? (
          <div className="invite-success">
            <CheckCircle2 size={52} />
            <p className="eyebrow">Contraseña actualizada</p>
            <h1>Tu acceso está protegido</h1>
            <p>Ya puedes iniciar sesión con tu nueva contraseña.</p>
            <button className="primary-button" onClick={onFinished}>Ir al inicio de sesión</button>
          </div>
        ) : (
          <>
            <div className="invite-icon"><KeyRound size={26} /></div>
            <p className="eyebrow">Recuperación de acceso</p>
            <h1>Crea una contraseña nueva</h1>
            <p>Debe contener al menos 12 caracteres, mayúscula, minúscula, número y símbolo.</p>
            <form onSubmit={submit} className="login-form">
              <label>
                <span>Nueva contraseña</span>
                <div className="input-with-icon">
                  <KeyRound size={18} />
                  <input
                    type={show ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShow((value) => !value)}
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <label>
                <span>Confirmar contraseña</span>
                <div className="input-with-icon">
                  <KeyRound size={18} />
                  <input
                    type={show ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
              </label>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="primary-button" disabled={loading}>
                {loading ? "Actualizando…" : "Cambiar contraseña"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
