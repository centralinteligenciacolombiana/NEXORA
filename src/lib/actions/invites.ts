"use server";

import { revalidatePath } from "next/cache";
import { getAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";

export type InviteActionState = {
  error?: string;
  success?: boolean;
  token?: string;
  url?: string;
  emailSent?: boolean;
  message?: string;
};

type InviteRole = "RESIDENT" | "SECURITY" | "STAFF";

const ALLOWED_INVITE_ROLES: InviteRole[] = ["RESIDENT", "SECURITY", "STAFF"];

const DEFAULT_LABEL: Record<InviteRole, string> = {
  RESIDENT: "Registro de residentes",
  SECURITY: "Registro de seguridad",
  STAFF: "Registro de mantenimiento",
};

function isInviteRole(role: string): role is InviteRole {
  return ALLOWED_INVITE_ROLES.includes(role as InviteRole);
}

export async function createInviteAction(
  _prev: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const roleRaw = String(formData.get("role") ?? "RESIDENT");
  const label = String(formData.get("label") ?? "").trim();

  if (!isInviteRole(roleRaw)) {
    return { error: "Rol de invitacion no permitido." };
  }

  const role: InviteRole = roleRaw;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesion." };
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
    return { error: "No se encontro el conjunto actual." };
  }

  const { data, error } = await supabase.rpc("create_complex_invite", {
    p_role: role,
    p_label: label || `${DEFAULT_LABEL[role]} - ${complex.name}`,
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
    return { error: "No se pudo generar el token de invitacion." };
  }

  const inviteUrl = `${getAppUrl()}/register/invite/${token}`;

  if (
    process.env.NODE_ENV === "production" &&
    /localhost|127\.0\.0\.1/i.test(inviteUrl)
  ) {
    return {
      error:
        "URL de produccion no configurada. Define NEXT_PUBLIC_APP_URL en Netlify.",
    };
  }

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
    message: `Enlace de ${roleLabel} listo. Compartelo o imprime el QR.`,
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
    return { error: "Invitacion no valida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesion." };
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
    return { error: "Invitacion no encontrada." };
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
    message: "Invitacion eliminada. El enlace ya no funciona.",
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
    message: "Registro rechazado. El usuario no tendra acceso al panel.",
  };
}
