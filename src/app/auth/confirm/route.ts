import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { ROLE_DASHBOARD, type UserRole } from "@/types";
import type { PendingRegistration } from "@/lib/email/send-verification";
import type { SupabaseClient } from "@supabase/supabase-js";

function redirectTo(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  url.pathname = path;
  url.search = "";
  return NextResponse.redirect(url);
}

async function completePendingRegistration(
  supabase: SupabaseClient,
  userId: string,
  pending: PendingRegistration | null | undefined,
): Promise<string> {
  if (!pending?.kind) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, complex_id")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.complex_id) {
      return "/onboarding";
    }
    return ROLE_DASHBOARD[(profile.role as UserRole) ?? "RESIDENT"];
  }

  if (pending.kind === "complex") {
    const { data, error } = await supabase.rpc("register_complex", {
      p_name: pending.name,
      p_slug: pending.slug,
      p_address: pending.address ?? null,
      p_city: pending.city ?? null,
      p_phone: pending.phone ?? null,
      p_email: pending.email ?? null,
      p_description: null,
    });

    if (error) {
      console.error("[auth/confirm] register_complex:", error.message);
      return "/register/complex/complete";
    }

    await supabase.auth.updateUser({
      data: { pending_registration: null },
    });

    const inviteToken =
      data && typeof data === "object" && "invite" in data
        ? (data as { invite?: { token?: string } }).invite?.token
        : undefined;

    if (inviteToken) {
      return `/dashboard/admin/invites?welcome=1&token=${inviteToken}`;
    }
    return "/dashboard/admin";
  }

  if (pending.kind === "invite") {
    const { error } = await supabase.rpc("accept_invite", {
      p_token: pending.inviteToken,
      p_unit_number: pending.unitNumber ?? null,
      p_tower: pending.tower ?? null,
      p_unit_id: pending.unitId ?? null,
      p_occupancy_type: pending.occupancyType ?? null,
    });

    if (error) {
      console.error("[auth/confirm] accept_invite:", error.message);
      return `/register/invite/${pending.inviteToken}`;
    }

    await supabase.auth.updateUser({
      data: { pending_registration: null },
    });

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    return ROLE_DASHBOARD[(profile?.role as UserRole) ?? "RESIDENT"];
  }

  return "/onboarding";
}

/**
 * Callback de confirmación de correo.
 * Soporta token_hash (Resend) y el flujo PKCE `code` de Supabase.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type") ?? "signup";
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  const supabase = await createClient();

  try {
    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        type: typeParam as EmailOtpType,
        token_hash: tokenHash,
      });
      if (error) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set(
          "error",
          "El enlace de confirmación no es válido o expiró.",
        );
        return NextResponse.redirect(url);
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "No se pudo completar la verificación.");
        return NextResponse.redirect(url);
      }
    } else {
      return redirectTo(request, "/login");
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return redirectTo(request, "/login");
    }

    const softEmail = searchParams.get("soft_email") === "1";

    const fullName = user.user_metadata?.full_name as string | undefined;
    await supabase
      .from("profiles")
      .update({
        email_confirmed_at: new Date().toISOString(),
        ...(fullName ? { full_name: fullName } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    // Marca explícita vía RPC (política endurecida)
    try {
      await supabase.rpc("confirm_own_email");
    } catch {
      // no bloquear
    }

    if (hasServiceRole()) {
      try {
        const admin = createAdminClient();
        await admin.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });
      } catch {
        // no bloquear
      }
    }

    const pending = user.user_metadata?.pending_registration as
      | PendingRegistration
      | null
      | undefined;

    if (next) {
      return redirectTo(request, next);
    }

    if (softEmail) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, complex_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.complex_id) {
        return redirectTo(
          request,
          ROLE_DASHBOARD[(profile.role as UserRole) ?? "RESIDENT"],
        );
      }
      return redirectTo(request, "/dashboard/resident/profile");
    }

    const destination = await completePendingRegistration(
      supabase,
      user.id,
      pending,
    );

    return redirectTo(request, destination);
  } catch (err) {
    console.error("[auth/confirm]", err);
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "Error al confirmar el correo.");
    return NextResponse.redirect(url);
  }
}
