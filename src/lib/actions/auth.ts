"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_DASHBOARD, type UserRole } from "@/types";
import { getEmailConfirmationMessage } from "@/lib/email/send-verification";
import { createAdminClient, findAuthUserIdByEmail, forceConfirmAuthEmail, hasServiceRole } from "@/lib/supabase/admin";

export type AuthActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const identifier = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!identifier || !password) {
    return { error: "Correo/unidad y contraseña son obligatorios." };
  }

  const supabase = await createClient();

  let email = identifier;
  if (!identifier.includes("@")) {
    const { data: resolved, error: resolveError } = await supabase.rpc(
      "resolve_login_identifier",
      { p_identifier: identifier },
    );

    if (resolveError) {
      return { error: resolveError.message };
    }

    const payload = resolved as {
      ok?: boolean;
      email?: string;
      error?: string;
    } | null;

    if (!payload?.ok || !payload.email) {
      return {
        error:
          payload?.error ??
          "No encontramos esa unidad. Usa tu correo electrónico.",
      };
    }
    email = payload.email;
  }

  let { error } = await supabase.auth.signInWithPassword({
    email: email.toLowerCase(),
    password,
  });

  // No bloqueamos por confirmación de correo: la confirmación es opcional (perfil).
  if (error && error.message.toLowerCase().includes("email not confirmed")) {
    const confirmed = await forceConfirmAuthEmail(email.toLowerCase());
    if (confirmed) {
      ({ error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password,
      }));
    }
  }

  if (error) {
    return { error: "Credenciales incorrectas. Intenta de nuevo." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "No se pudo obtener la sesión." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id, registration_status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id) {
    redirect("/onboarding");
  }

  const status = profile.registration_status ?? "APPROVED";
  if (
    (status === "PENDING" || status === "REJECTED") &&
    profile.role !== "ADMIN"
  ) {
    redirect("/dashboard/pending-approval");
  }

  const role = (profile.role as UserRole) ?? "RESIDENT";
  redirect(ROLE_DASHBOARD[role]);
}

export async function registerComplexAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const complexName = String(formData.get("complexName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput || complexName);

  if (!fullName || !email || !password || !complexName) {
    return {
      error: "Completa nombre, correo, contraseña y nombre del conjunto.",
    };
  }

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (!slug) {
    return { error: "No se pudo generar un identificador (slug) válido." };
  }

  const pending = {
    kind: "complex" as const,
    name: complexName,
    slug,
    address: address || undefined,
    city: city || undefined,
    phone: phone || undefined,
    email,
  };

  // Registro inmediato del admin (sin bloquear por Resend / dominio).
  if (hasServiceRole()) {
    try {
      const admin = createAdminClient();
      const { error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          phone,
          role: "ADMIN",
          pending_registration: pending,
        },
      });

      if (
        createError &&
        !createError.message.toLowerCase().includes("already")
      ) {
        return { error: createError.message };
      }

      const supabase = await createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return {
          error:
            "Cuenta creada. Inicia sesión para completar el conjunto.",
        };
      }

      const { data, error } = await supabase.rpc("register_complex", {
        p_name: complexName,
        p_slug: slug,
        p_address: address || null,
        p_city: city || null,
        p_phone: phone || null,
        p_email: email,
        p_description: null,
      });

      if (error) {
        return { error: error.message };
      }

      const {
        data: { user: signedUser },
      } = await supabase.auth.getUser();

      if (signedUser) {
        await supabase
          .from("profiles")
          .update({
            full_name: fullName,
            phone: phone || null,
            email,
            email_confirmed_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", signedUser.id);
      }

      const inviteToken =
        data && typeof data === "object" && "invite" in data
          ? (data as { invite?: { token?: string } }).invite?.token
          : undefined;

      if (inviteToken) {
        redirect(`/dashboard/admin/invites?welcome=1&token=${inviteToken}`);
      }

      redirect("/dashboard/admin");
    } catch (err) {
      if (
        err &&
        typeof err === "object" &&
        "digest" in err &&
        String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
      ) {
        throw err;
      }
      return {
        error:
          err instanceof Error ? err.message : "Error al registrar el conjunto.",
      };
    }
  }

  // Fallback sin service role
  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
      data: {
        full_name: fullName,
        phone,
        role: "ADMIN",
        pending_registration: pending,
      },
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  if (!signUpData.user) {
    return { error: "No se pudo crear la cuenta." };
  }

  if (!signUpData.session) {
    return {
      success: true,
      message: getEmailConfirmationMessage(),
    };
  }

  const { data, error } = await supabase.rpc("register_complex", {
    p_name: complexName,
    p_slug: slug,
    p_address: address || null,
    p_city: city || null,
    p_phone: phone || null,
    p_email: email,
    p_description: null,
  });

  if (error) {
    return { error: error.message };
  }

  const inviteToken =
    data && typeof data === "object" && "invite" in data
      ? (data as { invite?: { token?: string } }).invite?.token
      : undefined;

  if (inviteToken) {
    redirect(`/dashboard/admin/invites?welcome=1&token=${inviteToken}`);
  }

  redirect("/dashboard/admin");
}

export async function registerWithInviteAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = String(formData.get("token") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  const tower = String(formData.get("tower") ?? "").trim() || undefined;
  const unitNumber = String(formData.get("unitNumber") ?? "").trim() || undefined;
  const occupancyRaw = String(formData.get("occupancyType") ?? "")
    .trim()
    .toUpperCase();
  const occupancyType: "OWNER" | "TENANT" | "TEMPORARY" | undefined =
    occupancyRaw === "OWNER" ||
    occupancyRaw === "TENANT" ||
    occupancyRaw === "TEMPORARY"
      ? occupancyRaw
      : undefined;

  if (!token) {
    return { error: "Falta el enlace de invitación." };
  }

  if (!fullName || !email || !password) {
    return { error: "Completa nombre, correo y contraseña." };
  }

  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  if (password !== passwordConfirm) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();

  const { data: preview } = await supabase.rpc("get_invite_by_token", {
    p_token: token,
  });

  if (!preview || (preview as { valid?: boolean }).valid !== true) {
    return {
      error:
        "Esta invitación ha expirado o no es válida. Contacta a la administración de tu conjunto.",
    };
  }

  const inviteRole = ((preview as { invite?: { role?: string } }).invite
    ?.role ?? "RESIDENT") as UserRole;
  const inviteEmail = (preview as { invite?: { email?: string | null } })
    .invite?.email;

  if (inviteEmail && email.toLowerCase() !== inviteEmail.toLowerCase()) {
    return { error: "Debes registrarte con el correo de la invitación." };
  }

  const needsUnit = inviteRole === "RESIDENT";
  if (needsUnit && !unitNumber) {
    return { error: "Indica el número de tu apartamento o casa." };
  }
  if (needsUnit && !occupancyType) {
    return {
      error: "Indica si eres propietario, arrendatario u ocupación temporal.",
    };
  }

  // Registro inmediato: entra al panel sin esperar correo (Resend no bloquea).
  if (!hasServiceRole()) {
    return {
      error:
        "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor para completar el registro.",
    };
  }

  try {
    const admin = createAdminClient();
    const { error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
        role: inviteRole,
      },
    });

    const alreadyExists =
      Boolean(createError) &&
      createError!.message.toLowerCase().includes("already");

    if (createError && !alreadyExists) {
      return { error: createError.message };
    }

    // Si el correo ya existía (registro a medias), actualizamos clave y forzamos Auth OK.
    if (alreadyExists) {
      const existingId = await findAuthUserIdByEmail(email);
      if (!existingId) {
        return {
          error:
            "Este correo ya está registrado. Inicia sesión o pide a administración limpiar la cuenta.",
        };
      }
      const { error: updateError } = await admin.auth.admin.updateUserById(
        existingId,
        {
          password,
          email_confirm: true,
          user_metadata: {
            full_name: fullName,
            phone,
            role: inviteRole,
          },
        },
      );
      if (updateError) {
        return { error: updateError.message };
      }
    }

    let { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (
      signInError &&
      signInError.message.toLowerCase().includes("email not confirmed")
    ) {
      await forceConfirmAuthEmail(email);
      ({ error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      }));
    }

    if (signInError) {
      return {
        error:
          "No se pudo iniciar sesión con ese correo. Verifica la contraseña o pide a administración reiniciar la cuenta.",
      };
    }

    const { error: acceptError } = await supabase.rpc("accept_invite", {
      p_token: token,
      p_unit_number: unitNumber ?? null,
      p_tower: tower ?? null,
      p_unit_id: null,
      p_occupancy_type: occupancyType ?? null,
    });

    if (acceptError) {
      // Ya pertenece al conjunto: ir a espera o panel según estado
      if (
        acceptError.message.toLowerCase().includes("otro conjunto") ||
        acceptError.message.toLowerCase().includes("ya pertenece")
      ) {
        return { error: acceptError.message };
      }
      // Si ya aceptó antes, seguimos a pending
      const {
        data: { user: existingUser },
      } = await supabase.auth.getUser();
      if (existingUser) {
        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("complex_id, registration_status, role")
          .eq("id", existingUser.id)
          .maybeSingle();
        if (existingProfile?.complex_id) {
          if (
            existingProfile.registration_status === "PENDING" ||
            existingProfile.registration_status === "REJECTED"
          ) {
            redirect("/dashboard/pending-approval");
          }
          redirect(
            ROLE_DASHBOARD[(existingProfile.role as UserRole) ?? "RESIDENT"],
          );
        }
      }
      return { error: acceptError.message };
    }

    const {
      data: { user: signedUser },
    } = await supabase.auth.getUser();

    if (signedUser) {
      await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          phone: phone || null,
          email,
          // Soft confirm en perfil; Auth ya permite entrar
          email_confirmed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", signedUser.id);
    }

    redirect("/dashboard/pending-approval");
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    return {
      error:
        err instanceof Error ? err.message : "Error al completar el registro.",
    };
  }
}

/** Completa el registro del conjunto cuando el admin ya tiene sesión. */
export async function completeComplexRegistrationAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const complexName = String(formData.get("complexName") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const slugInput = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugInput || complexName);

  if (!complexName || !slug) {
    return { error: "El nombre del conjunto es obligatorio." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." };
  }

  const { data, error } = await supabase.rpc("register_complex", {
    p_name: complexName,
    p_slug: slug,
    p_address: address || null,
    p_city: city || null,
    p_phone: phone || null,
    p_email: user.email ?? null,
    p_description: null,
  });

  if (error) {
    return { error: error.message };
  }

  const inviteToken =
    data && typeof data === "object" && "invite" in data
      ? (data as { invite?: { token?: string } }).invite?.token
      : undefined;

  if (inviteToken) {
    redirect(`/dashboard/admin/invites?welcome=1&token=${inviteToken}`);
  }

  redirect("/dashboard/admin");
}

export async function acceptInviteForSessionAction(
  token: string,
  unitNumber?: string,
  tower?: string,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=/register/invite/${token}`);
  }

  const { error } = await supabase.rpc("accept_invite", {
    p_token: token,
    p_unit_number: unitNumber || null,
    p_tower: tower || null,
    p_unit_id: null,
    p_occupancy_type: null,
  });
  if (error) {
    redirect(
      `/register/invite/${token}?error=${encodeURIComponent(error.message)}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as UserRole) ?? "RESIDENT";
  redirect(ROLE_DASHBOARD[role]);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
