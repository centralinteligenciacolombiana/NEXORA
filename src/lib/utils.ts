import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ROLE_DASHBOARD, type UserRole } from "@/types";

/** Rutas base por rol de usuario */
export const ROLE_ROUTES = ROLE_DASHBOARD;

/** Verifica si un rol tiene acceso a una ruta de dashboard */
export function canAccessRoute(role: UserRole, pathname: string): boolean {
  const baseRoute = ROLE_ROUTES[role];
  return pathname.startsWith(baseRoute);
}

/** Formatea fecha para visualización en UI */
export function formatDate(date: Date | string, locale = "es-CO"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export function formatDateTime(date: Date | string, locale = "es-CO"): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

/** Combina clases de Tailwind de forma segura */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Genera slug URL-safe a partir de un nombre */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function inviteStatus(invite: {
  uses_count: number;
  max_uses: number | null;
  is_active: boolean;
  expires_at: string | null;
}): "accepted" | "pending" | "expired" | "inactive" {
  if (!invite.is_active) return "inactive";
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return "expired";
  }
  if (invite.uses_count > 0) return "accepted";
  return "pending";
}

export function buildInviteUrl(token: string): string {
  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/register/invite/${token}`;
}
