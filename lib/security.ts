import type { NextRequest } from "next/server";
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(256),
});

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});

const strongPasswordSchema = z
  .string()
  .min(12, "La contraseña debe tener al menos 12 caracteres.")
  .max(128)
  .regex(/[a-z]/, "Debe contener una minúscula.")
  .regex(/[A-Z]/, "Debe contener una mayúscula.")
  .regex(/[0-9]/, "Debe contener un número.")
  .regex(/[^A-Za-z0-9]/, "Debe contener un símbolo.");

const displayNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .refine(hasNoControlCharacters, "El nombre contiene caracteres no permitidos.");

export const invitationSchema = z.object({
  action: z.literal("invite").optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  fullName: displayNameSchema,
  role: z.enum(["administrador", "editor", "consulta"]),
  sectionIds: z.array(z.string().uuid()).max(100).refine((values) => new Set(values).size === values.length),
});

export const resendInvitationSchema = z.object({
  action: z.literal("resend"),
  invitationId: z.string().uuid(),
});

export const updateUserSchema = z.object({
  userId: z.string().uuid(),
  fullName: displayNameSchema,
  role: z.enum(["administrador", "editor", "consulta"]),
  status: z.enum(["activo", "inactivo"]),
  sectionIds: z.array(z.string().uuid()).max(100).refine((values) => new Set(values).size === values.length),
});

export const deleteUserSchema = z.object({
  userId: z.string().uuid(),
});

export const acceptInvitationSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: strongPasswordSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: strongPasswordSchema,
});

export function randomToken(bytes = 32): string {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return base64Url(values);
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function verifyCsrf(request: NextRequest): boolean {
  const cookie = request.cookies.get("tlm_csrf")?.value;
  const header = request.headers.get("x-csrf-token");
  return Boolean(
    cookie &&
    header &&
    /^[A-Za-z0-9_-]{32}$/.test(cookie) &&
    /^[A-Za-z0-9_-]{32}$/.test(header) &&
    constantTimeEqual(cookie, header),
  );
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

function base64Url(values: Uint8Array): string {
  let binary = "";
  values.forEach((value) => (binary += String.fromCharCode(value)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function hasNoControlCharacters(value: string): boolean {
  return Array.from(value).every((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint > 31 && codePoint !== 127;
  });
}
