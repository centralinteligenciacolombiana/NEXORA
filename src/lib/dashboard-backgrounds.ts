/**
 * Fondos locales en /public/images/backgrounds/
 * Nombres reales del proyecto (PNG).
 */

export type DashboardPanelKey = "landing" | "resident" | "security" | "admin";

const LOCAL_SETS: Record<DashboardPanelKey, string[]> = {
  // Portada pública (/)
  landing: [
    "/images/backgrounds/hero-resident.png",
    "/images/backgrounds/hero-resident-02.png",
    "/images/backgrounds/hero-resident-03.png",
  ],
  // Dashboard residente
  resident: [
    "/images/backgrounds/hero-resident.png",
    "/images/backgrounds/hero-resident-02.png",
    "/images/backgrounds/hero-resident-03.png",
  ],
  security: [
    "/images/backgrounds/security-bg-01.png",
    "/images/backgrounds/security-bg-02.png",
    "/images/backgrounds/security-bg-03.png",
  ],
  admin: [
    "/images/backgrounds/admin-bg-01.png",
    "/images/backgrounds/admin-bg-02.png",
    "/images/backgrounds/admin-bg-03.png",
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

export const LOCAL_BACKGROUND_SETS = LOCAL_SETS;
