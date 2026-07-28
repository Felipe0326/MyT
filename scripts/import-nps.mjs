import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

const sourcePath = path.resolve(process.argv[2] || "nps_citas.csv");
const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
const secretKey = required("SUPABASE_SERVICE_ROLE_KEY");
const rawBuffer = await readFile(sourcePath);
const sourceHash = createHash("sha256").update(rawBuffer).digest("hex");
const sourceText = rawBuffer.toString("utf8").replace(/^\uFEFF/, "");
const parsed = Papa.parse(sourceText, { header: true, skipEmptyLines: true });

if (parsed.errors.length) {
  const severe = parsed.errors.filter((error) => error.type !== "FieldMismatch");
  if (severe.length) throw new Error(`CSV inválido: ${severe[0].message}`);
}

const deduplicated = new Map();
for (const item of parsed.data) {
  const submitId = Number(item.submit_id);
  if (!Number.isSafeInteger(submitId)) continue;
  const row = {
    submit_id: submitId,
    booking_id: nullableInteger(item.booking_id),
    form_id: nullableInteger(item.form_id),
    survey_name: (cleanText(item.survey_name) || "Encuesta NPS").slice(0, 250),
    team_id: nullableInteger(item.team_id),
    dependencia: (cleanText(item.Dependencia) || "No especificada").slice(0, 250),
    team_branch_id: nullableInteger(item.team_branch_id),
    sucursal_branch: (cleanText(item.Sucursal_Branch) || "No especificada").slice(0, 250),
    booking_folio: nullableText(item.booking_folio, 100),
    booking_status: nullableText(item.booking_status, 100),
    start_at: parseLocalTimestamp(item.start_at),
    end_at: parseLocalTimestamp(item.end_at),
    check_in_at: parseLocalTimestamp(item.check_in_at),
    check_out_at: parseLocalTimestamp(item.check_out_at),
    entity_id: nullableInteger(item.entity_id),
    entity_type: nullableText(item.entity_type, 100),
    survey_submitted_at: parseLocalTimestamp(item.survey_submitted_at),
    booking_created_at: parseLocalTimestamp(item.booking_created_at),
    comentario_libre: cleanText(item.comentario_libre).slice(0, 10000),
    recomienda_citas: normalizeYesNo(item.recomienda_citas),
    estrellas_facilidad_uso: nullableRating(item.estrellas_facilidad_uso),
    estrellas_trato_personal: clampRating(item.estrellas_trato_personal),
  };
  if (!row.survey_submitted_at) continue;
  deduplicated.set(submitId, row);
}
const rows = [...deduplicated.values()];

const existing = await rest(`data_imports_tym?dashboard_slug=eq.dashboard-nps&source_sha256=eq.${sourceHash}&select=id,status&limit=1`);
if (existing.ok) {
  const imports = await existing.json();
  if (imports[0]?.status === "completado") {
    console.log(`El archivo ya fue importado (${rows.length.toLocaleString("es-MX")} registros válidos).`);
    process.exit(0);
  }
}

const createImport = await rest("data_imports_tym", {
  method: "POST",
  headers: { Prefer: "return=representation" },
  body: {
    dashboard_slug: "dashboard-nps",
    source_filename: path.basename(sourcePath),
    source_sha256: sourceHash,
    row_count: rows.length,
    status: "procesando",
  },
});
if (!createImport.ok) throw new Error(`No se pudo registrar la importación: ${await createImport.text()}`);
const importId = (await createImport.json())[0].id;

try {
  const batchSize = 500;
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize).map((row) => ({ ...row, import_id: importId }));
    const response = await rest("nps_responses_tym?on_conflict=submit_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: batch,
    });
    if (!response.ok) throw new Error(`Lote ${index / batchSize + 1}: ${await response.text()}`);
    console.log(`Procesados ${Math.min(index + batchSize, rows.length)} de ${rows.length} registros.`);
  }
  await rest(`data_imports_tym?id=eq.${importId}`, {
    method: "PATCH",
    body: { status: "completado", inserted_count: rows.length, finished_at: new Date().toISOString() },
  });
  console.log(`Importación terminada: ${rows.length.toLocaleString("es-MX")} respuestas NPS.`);
} catch (error) {
  await rest(`data_imports_tym?id=eq.${importId}`, {
    method: "PATCH",
    body: { status: "fallido", error_message: String(error).slice(0, 1500), finished_at: new Date().toISOString() },
  });
  throw error;
}

async function rest(resource, options = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${resource}`, {
    method: options.method || "GET",
    headers: {
      apikey: secretKey,
      Authorization: `Bearer ${secretKey}`,
      Accept: "application/json",
      ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}.`);
  return value;
}

function cleanText(value) {
  let text = String(value ?? "").trim();
  for (let attempt = 0; attempt < 2 && /Ã|Â|â€/.test(text); attempt += 1) {
    const repaired = Buffer.from(text, "latin1").toString("utf8");
    if (repaired.includes("�")) break;
    text = repaired;
  }
  return text.normalize("NFC");
}

function normalizeYesNo(value) {
  const normalized = cleanText(value).toLocaleLowerCase("es-MX");
  return normalized === "sí" || normalized === "si" || normalized.startsWith("s");
}

function nullableText(value, maxLength) {
  const text = cleanText(value);
  return !text || text.toLocaleUpperCase("es-MX") === "NULL" ? null : text.slice(0, maxLength);
}

function nullableInteger(value) {
  const text = cleanText(value);
  if (!text || text.toLocaleUpperCase("es-MX") === "NULL") return null;
  const number = Number(text);
  return Number.isSafeInteger(number) ? number : null;
}

function nullableRating(value) {
  const text = cleanText(value);
  if (!text || text.toLocaleUpperCase("es-MX") === "NULL") return null;
  return clampRating(text);
}

function clampRating(value) {
  const number = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(5, number));
}

function parseLocalTimestamp(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const sqlTimestamp = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?)$/);
  const date = new Date(sqlTimestamp ? `${sqlTimestamp[1]}T${sqlTimestamp[2]}-06:00` : text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
