"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface BackgroundMediaProps {
  images: string[];
  /** ms entre slides (default 7s) */
  intervalMs?: number;
  priority?: boolean;
  imageAlt?: string;
  className?: string;
}

/**
 * Carrusel de fondo con crossfade. Una sola imagen = estático.
 */
export function BackgroundMedia({
  images,
  intervalMs = 7000,
  priority = false,
  imageAlt = "",
  className,
}: BackgroundMediaProps) {
  const slides = images.filter((u) => u.trim().length > 0);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [slides.length, intervalMs]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("absolute inset-0 z-0", className)} aria-hidden>
      {slides.map((src, i) => {
        const active = i === index;
        return (
          <Image
            key={src}
            src={src}
            alt={imageAlt}
            fill
            priority={priority && i === 0}
            sizes="100vw"
            className={cn(
              "object-cover transition-opacity duration-1000 ease-in-out",
              active ? "opacity-100" : "opacity-0",
            )}
          />
        );
      })}
    </div>
  );
}
