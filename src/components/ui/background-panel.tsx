import type { ReactNode } from "react";
import { BackgroundMedia } from "@/components/ui/background-media";
import { cn } from "@/lib/utils";

type OverlayTone = "dark" | "light";

export interface BackgroundPanelProps {
  children: ReactNode;
  /** URL única (compat). Preferir bgImageUrls para carrusel. */
  bgImageUrl?: string | null;
  /** Varias URLs → transición crossfade. */
  bgImageUrls?: string[] | null;
  /**
   * Overlay de legibilidad.
   * dark → slate-900/60 (default); light → white/80.
   * También acepta clases Tailwind custom (ej. "bg-slate-950/70").
   */
  overlayOpacity?: OverlayTone | string;
  /** Aplica backdrop-blur al contenido (glass sobre el fondo). */
  blurEffect?: boolean | "md" | "lg";
  /** priority en Next/Image para above-the-fold */
  priority?: boolean;
  /** Intervalo del carrusel en ms */
  carouselIntervalMs?: number;
  className?: string;
  contentClassName?: string;
  /** Alt vacío por defecto: imagen decorativa */
  imageAlt?: string;
  rounded?: "none" | "xl" | "2xl" | "3xl";
}

const ROUNDED = {
  none: "rounded-none",
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  "3xl": "rounded-3xl",
} as const;

function resolveOverlay(overlay: OverlayTone | string | undefined): string {
  if (!overlay || overlay === "dark") return "bg-slate-900/60";
  if (overlay === "light") return "bg-white/80";
  return overlay;
}

function resolveBlur(blur: BackgroundPanelProps["blurEffect"]): string {
  if (!blur) return "";
  if (blur === "lg") return "backdrop-blur-lg";
  return "backdrop-blur-md";
}

/**
 * Panel con imagen(es) de fondo (Next/Image) + overlay WCAG-friendly,
 * o patrón mesh/puntos indigo si no hay imagen.
 */
export function BackgroundPanel({
  children,
  bgImageUrl,
  bgImageUrls,
  overlayOpacity = "dark",
  blurEffect = false,
  priority = false,
  carouselIntervalMs = 7000,
  className,
  contentClassName,
  imageAlt = "",
  rounded = "2xl",
}: BackgroundPanelProps) {
  const images =
    bgImageUrls?.filter((u) => u.trim().length > 0) ??
    (bgImageUrl?.trim() ? [bgImageUrl.trim()] : []);
  const hasImage = images.length > 0;
  const overlay = resolveOverlay(overlayOpacity);
  const blur = resolveBlur(blurEffect);

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden",
        ROUNDED[rounded],
        !hasImage && "nexora-bg-pattern",
        className,
      )}
    >
      {hasImage && (
        <BackgroundMedia
          images={images}
          priority={priority}
          intervalMs={carouselIntervalMs}
          imageAlt={imageAlt}
        />
      )}

      <div
        className={cn("absolute inset-0 z-[1]", overlay)}
        aria-hidden
      />

      <div className={cn("relative z-[2]", blur, contentClassName)}>
        {children}
      </div>
    </div>
  );
}

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
  /** blur más fuerte */
  blur?: "md" | "lg";
  padding?: "none" | "sm" | "md" | "lg";
}

const GLASS_PAD = {
  none: "",
  sm: "p-3 sm:p-4",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
} as const;

/**
 * Tarjeta glassmorphism: cristal translúcido sobre fondos con atmósfera.
 */
export function GlassCard({
  children,
  className,
  as: Tag = "div",
  blur = "md",
  padding = "md",
}: GlassCardProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-white/50 bg-white/75 shadow-sm ring-1 ring-black/5",
        blur === "lg" ? "backdrop-blur-lg" : "backdrop-blur-md",
        "supports-[backdrop-filter]:bg-white/65",
        GLASS_PAD[padding],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
