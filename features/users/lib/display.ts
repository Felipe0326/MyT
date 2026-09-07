import type { AppRole } from "@/lib/session";
import type { SectionRecord } from "@/features/users/types";
import { shouldTreatSectionAsAvailable } from "@/features/dashboards/core/catalog";

export function isSectionAvailable(section: SectionRecord) {
  return shouldTreatSectionAsAvailable(section.slug, section.availability);
}

export function roleLabel(role: AppRole) {
  return role === "administrador"
    ? "Administrador"
    : role === "editor"
      ? "Editor"
      : "Consulta";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
