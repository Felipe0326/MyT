import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("las rutas públicas sensibles tienen origen, cuerpo limitado y rate limit", async () => {
  const routes = await Promise.all([
    source("app/api/auth/login/route.ts"),
    source("app/api/auth/accept-invite/route.ts"),
    source("app/api/auth/request-password-reset/route.ts"),
    source("app/api/auth/reset-password/route.ts"),
  ]);

  for (const route of routes) {
    assert.match(route, /verifyMutationOrigin/);
    assert.match(route, /readLimitedJson/);
    assert.match(route, /consumeRateLimits/);
    assert.doesNotMatch(route, /request\.json\(/);
  }
});

test("la migración limita accesos a contadores y funciones", async () => {
  const sql = await source("SQL_EJECUTAR_V4_9_CORREO_Y_SEGURIDAD.sql");
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /security definer/i);
  assert.match(sql, /revoke all on public\.app_rate_limits_tym from public, anon, authenticated/i);
  assert.match(sql, /grant execute on function public\.consume_rate_limit_tym[\s\S]+to service_role/i);
  assert.match(sql, /grant execute on function public\.reset_rate_limit_tym\(text\) to service_role/i);
});

test("SMTP exige TLS moderno y certificados válidos", async () => {
  const email = await source("lib/email.ts");
  assert.match(email, /minVersion:\s*"TLSv1\.2"/);
  assert.match(email, /rejectUnauthorized:\s*true/);
  assert.match(email, /disableFileAccess:\s*true/);
  assert.match(email, /disableUrlAccess:\s*true/);
});

test("el worker rechaza métodos peligrosos antes del enrutador", async () => {
  const worker = await source("worker/index.ts");
  assert.match(worker, /\["TRACE", "TRACK", "CONNECT"\]\.includes/);
  assert.match(worker, /status:\s*405/);
});

test("el paquete conserva el plugin de compilación requerido por Vite", async () => {
  const viteConfig = await source("vite.config.ts");
  const plugin = await source("build/sites-vite-plugin.ts");
  assert.match(viteConfig, /\.\/build\/sites-vite-plugin/);
  assert.match(plugin, /export function sites\(\)/);
});
