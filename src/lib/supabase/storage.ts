import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PrivateBucket =
  | "payment-proofs"
  | "shift-evidence"
  | "maintenance-evidence";

/**
 * Extrae el path relativo dentro del bucket desde un path o URL completa.
 */
export function extractStoragePath(
  bucket: string,
  pathOrUrl: string | null | undefined,
): string | null {
  if (!pathOrUrl) return null;
  const raw = pathOrUrl.trim();
  if (!raw) return null;

  // Ya es path relativo (sin protocolo)
  if (!raw.includes("://") && !raw.includes("/storage/v1/object/")) {
    return raw.replace(/^\//, "");
  }

  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
  ];

  for (const marker of markers) {
    const idx = raw.indexOf(marker);
    if (idx === -1) continue;
    let path = raw.slice(idx + marker.length);
    const q = path.indexOf("?");
    if (q !== -1) path = path.slice(0, q);
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  }

  return null;
}

/**
 * Genera una URL firmada temporal para un objeto en un bucket privado.
 */
export async function getSignedStorageUrl(
  bucket: string,
  pathOrUrl: string | null | undefined,
  expiresInSeconds = 3600,
): Promise<string | null> {
  if (!pathOrUrl?.trim()) return null;

  const path = extractStoragePath(bucket, pathOrUrl);
  if (!path) {
    console.warn("[storage] No se pudo extraer path", { bucket, pathOrUrl });
    return null;
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      console.warn("[storage] createSignedUrl falló", {
        bucket,
        path,
        error: error?.message,
      });
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error("[storage] Excepción al firmar URL", err);
    return null;
  }
}

/**
 * Firma un arreglo de paths/URLs (mantiene el orden; null si falla alguno).
 */
export async function getSignedStorageUrls(
  bucket: string,
  paths: (string | null | undefined)[],
  expiresInSeconds = 3600,
): Promise<(string | null)[]> {
  return Promise.all(
    paths.map((p) => getSignedStorageUrl(bucket, p, expiresInSeconds)),
  );
}
