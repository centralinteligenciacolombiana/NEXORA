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
 * Carrusel de fondo con crossfade.
 * Solo monta la slide activa y la siguiente (ahorro de red/memoria).
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

  const nextIndex = slides.length > 1 ? (index + 1) % slides.length : index;
  const visible = new Set([index, nextIndex]);

  return (
    <div className={cn("absolute inset-0 z-0", className)} aria-hidden>
      {slides.map((src, i) => {
        if (!visible.has(i)) return null;
        const active = i === index;
        return (
          <Image
            key={`${src}-${i}`}
            src={src}
            alt={imageAlt}
            fill
            priority={priority && i === index}
            quality={65}
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
