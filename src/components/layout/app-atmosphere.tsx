import { cn } from "@/lib/utils";

interface AppAtmosphereProps {
  /** Imagen fija de fondo (ruta pública). */
  imageSrc: string;
  className?: string;
}

/**
 * Fondo atmosférico fijo vía CSS (sin next/image) para evitar
 * mismatches de hidratación en srcSet entre servidor y cliente.
 */
export function AppAtmosphere({ imageSrc, className }: AppAtmosphereProps) {
  return (
    <div
      className={cn("pointer-events-none fixed inset-0 -z-10", className)}
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${imageSrc})` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-[#14241f]/75 via-[#eef5f1]/82 to-[#eef5f1]/94" />
      <div className="absolute inset-0 bg-[var(--brand)]/10 mix-blend-multiply" />
    </div>
  );
}
