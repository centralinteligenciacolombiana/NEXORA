/**
 * Fondos locales en /public/images/backgrounds/
 * Preferimos WebP optimizados (~90–215KB) frente a PNG de 2MB+.
 */

import type { UserRole } from "@/types";

export type DashboardPanelKey = "landing" | "resident" | "security" | "admin";

const LOCAL_SETS: Record<DashboardPanelKey, string[]> = {
  landing: [
    "/images/backgrounds/optimized/hero-resident.webp",
    "/images/backgrounds/optimized/hero-resident-02.webp",
    "/images/backgrounds/optimized/hero-resident-03.webp",
  ],
  resident: [
    "/images/backgrounds/optimized/hero-resident.webp",
    "/images/backgrounds/optimized/hero-resident-02.webp",
    "/images/backgrounds/optimized/hero-resident-03.webp",
  ],
  security: [
    "/images/backgrounds/optimized/security-bg-01.webp",
    "/images/backgrounds/optimized/security-bg-02.webp",
    "/images/backgrounds/optimized/security-bg-03.webp",
  ],
  admin: [
    "/images/backgrounds/optimized/admin-bg-01.webp",
    "/images/backgrounds/optimized/admin-bg-02.webp",
    "/images/backgrounds/optimized/admin-bg-03.webp",
  ],
};

const ENV_BY_PANEL: Record<DashboardPanelKey, string> = {
  landing: "NEXT_PUBLIC_BG_LANDING_URL",
  resident: "NEXT_PUBLIC_BG_RESIDENT_URL",
  security: "NEXT_PUBLIC_BG_SECURITY_URL",
  admin: "NEXT_PUBLIC_BG_ADMIN_URL",
};

function envList(envKey: string): string[] | null {
  const fromEnv = process.env[envKey]?.trim();
  if (!fromEnv) return null;
  return fromEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Lista de imágenes por panel (carrusel). Env opcional; si no, locales. */
export function getDashboardBackgrounds(
  panel: DashboardPanelKey,
): string[] {
  const fromEnv = envList(ENV_BY_PANEL[panel]);
  if (fromEnv?.length) return fromEnv;
  return LOCAL_SETS[panel];
}

/** Imagen fija de atmósfera para el shell (toda la app autenticada). */
export function getShellBackground(role?: UserRole | null): string {
  if (role === "SECURITY") {
    return (
      LOCAL_SETS.security[0] ??
      "/images/backgrounds/optimized/security-bg-01.webp"
    );
  }
  if (role === "ADMIN") {
    return (
      LOCAL_SETS.admin[0] ?? "/images/backgrounds/optimized/admin-bg-01.webp"
    );
  }
  return (
    LOCAL_SETS.landing[0] ??
    "/images/backgrounds/optimized/hero-resident.webp"
  );
}

export const LOCAL_BACKGROUND_SETS = LOCAL_SETS;

/** Portada fija para login / registro */
export const APP_AUTH_BACKGROUND =
  LOCAL_SETS.landing[0] ??
  "/images/backgrounds/optimized/hero-resident.webp";
