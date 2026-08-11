import { format } from "@/features/nps/lib/date";

export function normalizeOptions(options: string[]): string[] {
  return Array.from(
    new Set(options.map((option) => option?.trim()).filter((option): option is string => Boolean(option))),
  ).sort((left, right) => left.localeCompare(right, "es-MX", { sensitivity: "base" }));
}

export function rangeFromMonth(value: string): { start: string; end: string } | null {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export function dateInputValue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthLabel(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  return new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit" })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
}

export function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : format(date, "dd MMM yyyy HH:mm");
}

export function wait(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export function downloadCsv(filename: string, headers: Array<string | number>, rows: Array<Array<unknown>>) {
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
