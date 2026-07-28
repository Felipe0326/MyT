import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

const sourcePath = path.resolve(process.argv[2] || "nps_citas_unificado.csv");
const targetPath = path.resolve(process.argv[3] || "nps_citas_supabase_tym.csv");
const rawBuffer = await readFile(sourcePath);
const parsed = Papa.parse(rawBuffer.toString("utf8").replace(/^\uFEFF/, ""), {
  header: true,
  skipEmptyLines: true,
});

const severeErrors = parsed.errors.filter((error) => error.type !== "FieldMismatch");
if (severeErrors.length) throw new Error(`CSV inválido: ${severeErrors[0].message}`);

const requiredColumns = [
  "submit_id",
  "booking_id",
  "form_id",
  "survey_name",
  "team_id",
  "Dependencia",
  "team_branch_id",
  "Sucursal_Branch",
  "booking_folio",
  "booking_status",
  "start_at",
  "end_at",
  "check_in_at",
  "check_out_at",
  "entity_id",
  "entity_type",
  "survey_submitted_at",
  "booking_created_at",
  "comentario_libre",
  "recomienda_citas",
  "estrellas_facilidad_uso",
  "estrellas_trato_personal",
];
const missingColumns = requiredColumns.filter((column) => !parsed.meta.fields?.includes(column));
if (missingColumns.length) throw new Error(`Faltan columnas: ${missingColumns.join(", ")}`);

let invalidRows = 0;
const deduplicated = new Map();
for (const item of parsed.data) {
  const submitId = Number(item.submit_id);
  const submittedAt = parseLocalTimestamp(item.survey_submitted_at);
  if (!Number.isSafeInteger(submitId) || !submittedAt) {
    invalidRows += 1;
    continue;
  }

  deduplicated.set(submitId, {
    submit_id: submitId,
    booking_id: nullableInteger(item.booking_id),
    form_id: nullableInteger(item.form_id),
    survey_name: cleanText(item.survey_name).slice(0, 250) || "Encuesta NPS",
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
    survey_submitted_at: submittedAt,
    booking_created_at: parseLocalTimestamp(item.booking_created_at),
    comentario_libre: cleanText(item.comentario_libre).slice(0, 10000),
    recomienda_citas: normalizeYesNo(item.recomienda_citas),
    estrellas_facilidad_uso: nullableRating(item.estrellas_facilidad_uso),
    estrellas_trato_personal: clampRating(item.estrellas_trato_personal),
  });
}

const rows = [...deduplicated.values()];
await mkdir(path.dirname(targetPath), { recursive: true });
await writeFile(targetPath, `\uFEFF${Papa.unparse(rows, { newline: "\r\n" })}`, "utf8");

console.log(`Archivo creado: ${targetPath}`);
console.log(`Filas de origen: ${parsed.data.length.toLocaleString("es-MX")}`);
console.log(`Registros válidos y únicos: ${rows.length.toLocaleString("es-MX")}`);
console.log(`Filas omitidas por identificador o fecha inválidos: ${invalidRows.toLocaleString("es-MX")}`);
console.log(`Duplicados reemplazados por la fila más reciente: ${(parsed.data.length - invalidRows - rows.length).toLocaleString("es-MX")}`);

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
  return normalized === "sí" || normalized === "si" || normalized === "true" || normalized === "1" || normalized.startsWith("s");
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
