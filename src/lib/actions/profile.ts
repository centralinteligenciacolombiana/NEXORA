"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { canSendResendVerification } from "@/lib/email/send-verification";
import { notificationService } from "@/lib/notifications";
import { getAppUrl } from "@/lib/email/resend";

export type ProfileActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

async function requireProfileUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

export async function updateOwnProfileAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const auth = await requireProfileUser();
  if (auth.error || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) {
    return { error: "El nombre es obligatorio." };
  }

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      full_name: fullName,
      phone: phone || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  await auth.supabase.auth.updateUser({
    data: { full_name: fullName, phone },
  });

  revalidatePath("/dashboard/resident/profile");
  revalidatePath("/dashboard/resident");
  return { success: true, message: "Datos actualizados." };
}

export async function uploadOwnAvatarAction(
  _prev: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const auth = await requireProfileUser();
  if (auth.error || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona una imagen." };
  }

  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return { error: "Usa JPG, PNG, WebP o GIF." };
  }

  if (file.size > 2 * 1024 * 1024) {
    return { error: "La imagen no puede superar 2 MB." };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";

  const path = `${auth.user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await auth.supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return { error: `No se pudo subir: ${uploadError.message}` };
  }

  const { data: publicUrl } = auth.supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  // Cache-bust para ver el cambio de inmediato
  const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;

  const { error } = await auth.supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/profile");
  revalidatePath("/dashboard/resident");
  return { success: true, message: "Foto de perfil actualizada." };
}

/**
 * Envía (o reenvía) el enlace de confirmación. No bloquea si Resend falla.
 */
export async function requestEmailConfirmationAction(
  _prev: ProfileActionState,
): Promise<ProfileActionState> {
  const auth = await requireProfileUser();
  if (auth.error || !auth.user?.email) {
    return { error: auth.error ?? "No hay correo en la cuenta." };
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("email_confirmed_at, full_name")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (profile?.email_confirmed_at) {
    return { success: true, message: "Tu correo ya está confirmado." };
  }

  if (!canSendResendVerification() || !hasServiceRole()) {
    return {
      error:
        "El envío de correo aún no está disponible. Puedes seguir usando la app con normalidad.",
    };
  }

  try {
    const admin = createAdminClient();
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email: auth.user.email,
        options: {
          redirectTo: `${getAppUrl()}/auth/confirm?soft_email=1`,
        },
      });

    if (linkError || !linkData.properties?.hashed_token) {
      return {
        error:
          linkError?.message ??
          "No se pudo generar el enlace. Intenta más tarde.",
      };
    }

    const token = linkData.properties.hashed_token;
    const result = await notificationService.sendVerificationCode({
      to: auth.user.email,
      name: profile?.full_name ?? "Usuario",
      token,
      type: "EMAIL",
      otpType: "magiclink",
      code: token.slice(0, 6).toUpperCase(),
    });

    if (!result.success) {
      return {
        error:
          "No pudimos enviar el correo ahora (límite de prueba de Resend o dominio). Sigue usando la app; confirma más adelante.",
      };
    }

    return {
      success: true,
      message: "Te enviamos un enlace de confirmación. Revisa tu bandeja.",
    };
  } catch {
    return {
      error:
        "No pudimos enviar el correo ahora. Puedes seguir usando la app normalmente.",
    };
  }
}
