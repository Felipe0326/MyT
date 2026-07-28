type ClassValue = string | number | false | null | undefined | ClassValue[] | Record<string, boolean>;

function normalize(value: ClassValue): string[] {
  if (!value) return [];
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(normalize);
  return Object.entries(value)
    .filter(([, enabled]) => enabled)
    .map(([className]) => className);
}

export function cn(...inputs: ClassValue[]) {
  return inputs.flatMap(normalize).join(" ");
}
