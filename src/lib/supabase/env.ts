/**
 * Normaliza la URL del proyecto Supabase.
 * Debe ser solo el origin (sin /rest/v1 ni /auth/v1).
 */
export function getSupabaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!raw) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en el entorno.");
  }

  try {
    const url = new URL(raw);
    // Quita paths erróneos tipo /rest/v1, /auth/v1, etc.
    return url.origin;
  } catch {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL inválida: "${raw}". Usa https://TU_REF.supabase.co`,
    );
  }
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!key) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");
  }
  return key;
}
