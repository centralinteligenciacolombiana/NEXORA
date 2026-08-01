"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { combineBogotaDateTime } from "@/lib/reservations";
import type { MoveRequestType } from "@/lib/moves";

export type MoveActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

async function requireResidentWithUnit() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "Debes iniciar sesión." as const,
      supabase,
      profile: null,
      user: null,
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id, unit_id, registration_status")
    .eq("id", user.id)
    .maybeSingle();
  if (
    !profile?.complex_id ||
    profile.role !== "RESIDENT" ||
    !profile.unit_id ||
    profile.registration_status === "PENDING" ||
    profile.registration_status === "REJECTED"
  ) {
    return {
      error: "Solo residentes autorizados con unidad." as const,
      supabase,
      profile: null,
      user: null,
    };
  }
  return { error: null, supabase, profile, user };
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "Debes iniciar sesión." as const,
      supabase,
      profile: null,
      user: null,
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.complex_id || profile.role !== "ADMIN") {
    return {
      error: "Solo administradores pueden aprobar o rechazar mudanzas." as const,
      supabase,
      profile: null,
      user: null,
    };
  }
  return { error: null, supabase, profile, user };
}

async function requireSecurity() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: "Debes iniciar sesión." as const,
      supabase,
      profile: null,
      user: null,
    };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.complex_id || profile.role !== "SECURITY") {
    return {
      error: "Solo seguridad puede verificar mudanzas en portería." as const,
      supabase,
      profile: null,
      user: null,
    };
  }
  return { error: null, supabase, profile, user };
}

function revalidateMovePaths() {
  revalidatePath("/dashboard/resident/moves");
  revalidatePath("/dashboard/admin/moves");
  revalidatePath("/dashboard/security/moves");
}

export async function createMoveRequestAction(
  _prev: MoveActionState,
  formData: FormData,
): Promise<MoveActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const typeRaw = String(formData.get("requestType") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const time = String(formData.get("time") ?? "").trim();
  const movingCompany = String(formData.get("movingCompany") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (typeRaw !== "MOVE_IN" && typeRaw !== "MOVE_OUT") {
    return { error: "Indica si es ingreso o salida." };
  }
  const requestType = typeRaw as MoveRequestType;

  const proposed = combineBogotaDateTime(date, time);
  if (!proposed) {
    return { error: "Fecha u hora inválidas." };
  }
  if (proposed.getTime() < Date.now() - 60 * 60 * 1000) {
    return { error: "La fecha propuesta no puede estar en el pasado." };
  }

  const { error } = await auth.supabase.from("move_requests").insert({
    complex_id: auth.profile.complex_id,
    unit_id: auth.profile.unit_id,
    requested_by: auth.user.id,
    request_type: requestType,
    proposed_at: proposed.toISOString(),
    moving_company: movingCompany || null,
    notes: notes || null,
    status: "PENDING",
  });

  if (error) {
    return { error: error.message };
  }

  revalidateMovePaths();
  return {
    success: true,
    message:
      "Solicitud enviada. La administración la revisará; portería verificará el día de la mudanza.",
  };
}

export async function cancelMoveRequestAction(
  requestId: string,
): Promise<MoveActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("move_requests")
    .delete()
    .eq("id", requestId)
    .eq("requested_by", auth.user.id)
    .eq("status", "PENDING");

  if (error) return { error: error.message };
  revalidateMovePaths();
  return { success: true, message: "Solicitud cancelada." };
}

/** Solo ADMIN — decisión administrativa (depósitos, ascensor, reglamento). */
export async function reviewMoveRequestAction(params: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
  reviewNotes?: string;
}): Promise<MoveActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("move_requests")
    .update({
      status: params.status,
      reviewed_by: auth.user.id,
      reviewed_at: new Date().toISOString(),
      review_notes: params.reviewNotes?.trim() || null,
    })
    .eq("id", params.requestId)
    .eq("complex_id", auth.profile.complex_id)
    .eq("status", "PENDING");

  if (error) return { error: error.message };

  revalidateMovePaths();
  return {
    success: true,
    message:
      params.status === "APPROVED"
        ? "Mudanza autorizada."
        : "Solicitud rechazada.",
  };
}

/** Solo SECURITY — verificación física en portería de una mudanza ya APPROVED. */
export async function verifyMoveAtDoorAction(
  requestId: string,
): Promise<MoveActionState> {
  const auth = await requireSecurity();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const now = new Date().toISOString();
  const { data, error } = await auth.supabase
    .from("move_requests")
    .update({
      verified_at: now,
      verified_by: auth.user.id,
    })
    .eq("id", requestId)
    .eq("complex_id", auth.profile.complex_id)
    .eq("status", "APPROVED")
    .is("verified_at", null)
    .select("id, request_type")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "No se pudo verificar. Debe estar aprobada y aún sin verificación en portería.",
    };
  }

  revalidateMovePaths();
  return {
    success: true,
    message:
      data.request_type === "MOVE_OUT"
        ? "Salida verificada en portería."
        : "Ingreso verificado en portería.",
  };
}
