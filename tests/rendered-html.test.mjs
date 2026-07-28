import assert from "node:assert/strict";
import test from "node:test";

const workerUrl = new URL("../dist/server/index.js", import.meta.url);

async function render(pathname = "/") {
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`https://tableros.example${pathname}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renderiza la entrada segura de Movilidad y Transporte", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Movilidad y Transporte/);
  assert.match(html, /Protegiendo tu acceso/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("incluye encabezados defensivos", async () => {
  const response = await render();
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  const csp = response.headers.get("content-security-policy") ?? "";
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(response.headers.get("strict-transport-security") ?? "", /max-age=63072000/);
});

test("rechaza cuerpos API declarados por encima del máximo global", async () => {
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-large-body`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("https://tableros.example/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "1048577" },
      body: "{}",
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 413);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
});
