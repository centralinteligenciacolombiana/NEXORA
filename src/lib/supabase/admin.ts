import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Cliente Supabase con service role (solo servidor).
 * Usar para generateLink y confirmar email.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function hasServiceRole(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Busca un usuario Auth por correo (Admin API). */
export async function findAuthUserIdByEmail(
  email: string,
): Promise<string | null> {
  if (!hasServiceRole()) return null;
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || !data?.users?.length) return null;

    const found = data.users.find(
      (u: User) => u.email?.toLowerCase() === target,
    );
    if (found) return found.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Marca el correo como confirmado en Auth (sin enviar email). */
export async function forceConfirmAuthEmail(email: string): Promise<boolean> {
  const id = await findAuthUserIdByEmail(email);
  if (!id || !hasServiceRole()) return false;
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    email_confirm: true,
  });
  return !error;
}
