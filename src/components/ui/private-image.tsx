import type { ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { getSignedStorageUrl } from "@/lib/supabase/storage";
import { cn } from "@/lib/utils";

interface PrivateImageProps {
  bucket: string;
  path: string | null | undefined;
  alt?: string;
  className?: string;
  /** Clases del contenedor cuando falla o no hay imagen */
  fallbackClassName?: string;
  expiresInSeconds?: number;
}

/**
 * Server Component: firma un path de Storage y renderiza la imagen.
 */
export async function PrivateImage({
  bucket,
  path,
  alt = "",
  className,
  fallbackClassName,
  expiresInSeconds = 3600,
}: PrivateImageProps) {
  const signedUrl = await getSignedStorageUrl(bucket, path, expiresInSeconds);

  if (!signedUrl) {
    return (
      <span
        className={cn(
          "flex items-center justify-center bg-[var(--slate-100)] text-[var(--muted)]",
          fallbackClassName ?? className,
        )}
        role="img"
        aria-label={alt || "Imagen no disponible"}
      >
        <ImageOff className="size-6" aria-hidden />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={signedUrl} alt={alt} className={className} />
  );
}

interface PrivateImageLinkProps {
  bucket: string;
  path: string | null | undefined;
  children: ReactNode;
  className?: string;
  expiresInSeconds?: number;
}

/** Enlace a un archivo privado (abre la URL firmada). */
export async function PrivateImageLink({
  bucket,
  path,
  children,
  className,
  expiresInSeconds = 3600,
}: PrivateImageLinkProps) {
  const signedUrl = await getSignedStorageUrl(bucket, path, expiresInSeconds);

  if (!signedUrl) {
    return (
      <span className={cn("text-sm text-[var(--muted)]", className)}>
        Archivo no disponible
      </span>
    );
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}
