"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";

export type InviteActionState = {
  error?: string;
  success?: boolean;
  token?: string;
  url?: string;
  emailSent?: boolean;
  message?: string;
};

const ALLOWED_INVITE_ROLES: UserRole[] = ["RESIDENT", "SECURITY", "STAFF"];

export async function createInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const role = String(formData.get("role") ?? "RESIDENT") as UserRole;
  const label = String(formData.get("label") ?? "").trim();

  if (!ALLOWED_INVITE_ROLES.includes(role)) {
    return { error: "Rol de invitación no permitido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "ADMIN" || !profile.complex_id) {
    return { error: "Solo administradores pueden crear invitaciones." };
  }

  const { data: complex } = await supabase
    .from("complexes")
    .select("id, name")
    .eq("id", profile.complex_id)
    .maybeSingle();

  if (!complex?.name) {
    return { error: "No se encontró el conjunto actual." };
  }

  const { data, error } = await supabase.rpc("create_complex_invite", {
    p_role: role,
    p_label: label || `Registro abierto — ${complex.name}`,
    p_max_uses: null,
    p_expires_at: null,
    p_unit_id: null,
    p_email: null,
  });

  if (error) {
    return { error: error.message };
  }

  const token =
    data && typeof data === "object" && "token" in data
      ? String((data as { token: string }).token)
      : undefined;

  if (!token) {
    return { error: "No se pudo generar el token de invitación." };
  }

  const base = (
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).replace(/\/$/, "");
  const inviteUrl = `${base}/register/invite/${token}`;

  revalidatePath("/dashboard/admin/invites");
  revalidatePath("/dashboard/admin/approvals");

  const roleLabel =
    role === "SECURITY"
      ? "seguridad"
      : role === "STAFF"
        ? "mantenimiento"
        : "residentes";

  return {
    success: true,
    token,
    url: inviteUrl,
    emailSent: false,
    message: `Enlace de ${roleLabel} listo. Compártelo o imprime el QR.`,
  };
}

export type DeleteInviteState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function deleteInviteAction(
  inviteId: string,
): Promise<DeleteInviteState> {
  if (!inviteId) {
    return { error: "Invitación no válida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "ADMIN" || !profile.complex_id) {
    return { error: "Solo administradores pueden eliminar invitaciones." };
  }

  const { data: invite, error: findError } = await supabase
    .from("complex_invites")
    .select("id, complex_id, uses_count")
    .eq("id", inviteId)
    .maybeSingle();

  if (findError) {
    return { error: findError.message };
  }

  if (!invite || invite.complex_id !== profile.complex_id) {
    return { error: "Invitación no encontrada." };
  }

  const { error } = await supabase
    .from("complex_invites")
    .delete()
    .eq("id", inviteId)
    .eq("complex_id", profile.complex_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/invites");
  return {
    success: true,
    message: "Invitación eliminada. El enlace ya no funciona.",
  };
}

export type ApprovalActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function approveRegistrationAction(
  userId: string,
): Promise<ApprovalActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_registration", {
    p_user_id: userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/approvals");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/pending-approval");
  return { success: true, message: "Registro confirmado. Ya tiene acceso." };
}

export async function rejectRegistrationAction(
  userId: string,
): Promise<ApprovalActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_registration", {
    p_user_id: userId,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/approvals");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/pending-approval");
  return {
    success: true,
    message: "Registro rechazado. El usuario no tendrá acceso al panel.",
  };
}
