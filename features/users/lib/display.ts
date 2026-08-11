import type { AppRole } from "@/lib/session";
import type { SectionRecord } from "@/features/users/types";

export function isSectionAvailable(section: SectionRecord) {
  return section.availability === "disponible" || section.slug === "dashboard-2";
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
