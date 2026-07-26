import { notificationService } from "@/lib/notifications";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { getAppUrl } from "@/lib/email/resend";

export type PendingComplexRegistration = {
  kind: "complex";
  name: string;
  slug: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
};

export type PendingInviteRegistration = {
  kind: "invite";
  inviteToken: string;
  unitNumber?: string;
  tower?: string;
  unitId?: string;
  occupancyType?: "OWNER" | "TENANT" | "TEMPORARY";
};

export type PendingRegistration =
  | PendingComplexRegistration
  | PendingInviteRegistration;

const CONFIRMATION_MESSAGE =
  "Hemos enviado un correo de confirmación a tu e-mail. Revisa tu bandeja de entrada o spam para activar tu cuenta.";

export function getEmailConfirmationMessage(): string {
  return CONFIRMATION_MESSAGE;
}

export function canSendResendVerification(): boolean {
  return Boolean(process.env.RESEND_API_KEY && hasServiceRole());
}

/**
 * Crea el usuario (sin confirmar) vía Admin API, genera token seguro
 * y envía el correo de confirmación con Resend.
 */
export async function createUserAndSendVerification(params: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role: string;
  pending: PendingRegistration;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!canSendResendVerification()) {
    return {
      ok: false,
      error:
        "Configura RESEND_API_KEY y SUPABASE_SERVICE_ROLE_KEY para el correo de confirmación.",
    };
  }

  const admin = createAdminClient();
  const userMetadata = {
    full_name: params.name,
    phone: params.phone ?? "",
    role: params.role,
    pending_registration: params.pending,
  };

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "signup",
      email: params.email,
      password: params.password,
      options: {
        data: userMetadata,
        redirectTo: `${getAppUrl()}/auth/confirm`,
      },
    });

  if (linkError) {
    return { ok: false, error: linkError.message };
  }

  const hashedToken = linkData.properties?.hashed_token;
  if (!hashedToken) {
    return {
      ok: false,
      error: "No se pudo generar el enlace de verificación.",
    };
  }

  const code = hashedToken.slice(0, 6).toUpperCase();
  const result = await notificationService.sendVerificationCode({
    to: params.email,
    name: params.name,
    token: hashedToken,
    type: "EMAIL",
    otpType: "signup",
    code,
  });

  if (!result.success) {
    return {
      ok: false,
      error: result.error ?? "No se pudo enviar el correo de confirmación.",
    };
  }

  return { ok: true };
}
