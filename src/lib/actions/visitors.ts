"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  computeVisitorValidity,
  OPEN_ACCESS_DAY_OPTIONS,
} from "@/lib/visitors";
import type { VisitorAccessType } from "@/types";

export type VisitorActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  visitorId?: string;
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
    profile.registration_status === "PENDING" ||
    profile.registration_status === "REJECTED"
  ) {
    return {
      error: "Solo residentes autorizados pueden gestionar visitas." as const,
      supabase,
      profile: null,
      user: null,
    };
  }

  if (!profile.unit_id) {
    return {
      error: "Tu cuenta no tiene unidad asignada." as const,
      supabase,
      profile: null,
      user: null,
    };
  }

  return { error: null, supabase, profile, user };
}

function parseAccessType(raw: string): VisitorAccessType | null {
  if (raw === "TODAY" || raw === "OPEN") return raw;
  return null;
}

function parseOpenDays(raw: string, accessType: VisitorAccessType): number {
  if (accessType === "TODAY") return 1;
  const n = Number(raw);
  if (
    OPEN_ACCESS_DAY_OPTIONS.includes(
      n as (typeof OPEN_ACCESS_DAY_OPTIONS)[number],
    )
  ) {
    return n;
  }
  return 7;
}

function generateVisitorQrCode(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createVisitorPassAction(
  _prev: VisitorActionState,
  formData: FormData,
): Promise<VisitorActionState> {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const accessType = parseAccessType(
    String(formData.get("accessType") ?? "TODAY"),
  );
  const openDays = parseOpenDays(
    String(formData.get("openDays") ?? "7"),
    accessType ?? "TODAY",
  );
  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName || !lastName) {
    return { error: "Indica nombre y apellido del visitante." };
  }

  if (!accessType) {
    return { error: "Tipo de acceso no válido." };
  }

  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const visitorName = `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  const { validFrom, validUntil } = computeVisitorValidity(
    accessType,
    openDays,
  );

  const { data, error } = await auth.supabase
    .from("visitors")
    .insert({
      unit_id: auth.profile.unit_id,
      visitor_name: visitorName,
      access_type: accessType,
      valid_from: validFrom,
      valid_until: validUntil,
      status: "APPROVED",
      created_by: auth.user.id,
      notes: notes || null,
      is_delivery: false,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/visits");
  revalidatePath("/dashboard/resident");
  return {
    success: true,
    message: "Visitante autorizado. Comparte o muestra el QR en portería.",
    visitorId: data.id,
  };
}

export async function renewVisitorPassAction(
  visitorId: string,
  accessType: VisitorAccessType,
  openDays = 7,
): Promise<VisitorActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { data: existing, error: findError } = await auth.supabase
    .from("visitors")
    .select("id, unit_id, status")
    .eq("id", visitorId)
    .maybeSingle();

  if (findError) {
    return { error: findError.message };
  }

  if (!existing || existing.unit_id !== auth.profile.unit_id) {
    return { error: "Pase no encontrado." };
  }

  if (existing.status === "DENIED") {
    return { error: "Este pase fue denegado y no se puede renovar." };
  }

  const { validFrom, validUntil } = computeVisitorValidity(
    accessType,
    openDays,
  );

  const { error } = await auth.supabase
    .from("visitors")
    .update({
      access_type: accessType,
      valid_from: validFrom,
      valid_until: validUntil,
      status: "APPROVED",
      entry_time: null,
      exit_time: null,
      // Nuevo código: el QR anterior deja de servir.
      qr_code: generateVisitorQrCode(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitorId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/visits");
  revalidatePath(`/dashboard/resident/visits/${visitorId}`);
  return {
    success: true,
    message: "Pase renovado. Usa el nuevo código QR.",
    visitorId,
  };
}

export async function cancelVisitorPassAction(
  visitorId: string,
): Promise<VisitorActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { data: existing, error: findError } = await auth.supabase
    .from("visitors")
    .select("id, unit_id, status")
    .eq("id", visitorId)
    .maybeSingle();

  if (findError) {
    return { error: findError.message };
  }

  if (!existing || existing.unit_id !== auth.profile.unit_id) {
    return { error: "Pase no encontrado." };
  }

  if (existing.status === "CANCELLED") {
    return { success: true, message: "El pase ya estaba cancelado.", visitorId };
  }

  const { error } = await auth.supabase
    .from("visitors")
    .update({
      status: "CANCELLED",
      updated_at: new Date().toISOString(),
    })
    .eq("id", visitorId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/visits");
  revalidatePath(`/dashboard/resident/visits/${visitorId}`);
  return {
    success: true,
    message: "Autorización cancelada. El QR ya no es válido.",
    visitorId,
  };
}
