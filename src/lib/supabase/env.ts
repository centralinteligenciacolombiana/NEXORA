/**
 * Lectura segura de env para middleware (Edge).
 * No lanza: si falta config, el middleware puede degradar sin tumbar el sitio.
 */
export function getSupabaseUrlSafe(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function getSupabaseAnonKeySafe(): string | null {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return key || null;
}

/**
 * Normaliza la URL del proyecto Supabase.
 * Debe ser solo el origin (sin /rest/v1 ni /auth/v1).
 */
export function getSupabaseUrl(): string {
  const origin = getSupabaseUrlSafe();
  if (!origin) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en el entorno.");
  }
  return origin;
}

export function getSupabaseAnonKey(): string {
  const key = getSupabaseAnonKeySafe();
  if (!key) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_ANON_KEY en el entorno.");
  }
  return key;
}
