"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  combineBogotaDateTime,
  timeToMinutes,
} from "@/lib/reservations";

export type ReservationActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, profile: null };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.complex_id || profile.role !== "ADMIN") {
    return { error: "Solo administradores." as const, supabase, profile: null };
  }
  return { error: null, supabase, profile, user };
}

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
      error: "Solo residentes con unidad." as const,
      supabase,
      profile: null,
      user: null,
    };
  }
  return { error: null, supabase, profile, user };
}

function revalidateReservationPaths() {
  revalidatePath("/dashboard/resident/reservations");
  revalidatePath("/dashboard/admin/amenities");
  revalidatePath("/dashboard/resident");
}

export async function upsertAmenityAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const id = String(formData.get("amenityId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const rules = String(formData.get("rules") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();
  const availableFrom = String(formData.get("availableFrom") ?? "08:00").trim();
  const availableTo = String(formData.get("availableTo") ?? "22:00").trim();
  const requiresApproval = formData.get("requiresApproval") === "on";
  const isActive = formData.get("isActive") === "on";
  const maxHoursRaw = String(formData.get("maxHours") ?? "").trim();

  if (!name) return { error: "El nombre es obligatorio." };
  const fromMin = timeToMinutes(availableFrom);
  const toMin = timeToMinutes(availableTo);
  if (fromMin == null || toMin == null || fromMin >= toMin) {
    return { error: "Horario inválido (inicio debe ser antes del fin)." };
  }

  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;
  if (capacityRaw && (!Number.isFinite(capacity) || (capacity ?? 0) < 1)) {
    return { error: "Capacidad inválida." };
  }

  const maxHours = maxHoursRaw ? Number.parseFloat(maxHoursRaw) : null;
  if (maxHoursRaw && (!Number.isFinite(maxHours) || (maxHours ?? 0) <= 0)) {
    return { error: "Máximo de horas inválido." };
  }

  const payload = {
    complex_id: auth.profile.complex_id,
    name,
    description: description || null,
    rules: rules || null,
    capacity,
    available_from: availableFrom.length === 5 ? `${availableFrom}:00` : availableFrom,
    available_to: availableTo.length === 5 ? `${availableTo}:00` : availableTo,
    requires_approval: requiresApproval,
    is_active: isActive,
    max_hours: maxHours,
  };

  if (id) {
    const { error } = await auth.supabase
      .from("amenities")
      .update(payload)
      .eq("id", id)
      .eq("complex_id", auth.profile.complex_id);
    if (error) return { error: error.message };
  } else {
    const { error } = await auth.supabase.from("amenities").insert(payload);
    if (error) return { error: error.message };
  }

  revalidateReservationPaths();
  return {
    success: true,
    message: id ? "Zona común actualizada." : "Zona común creada.",
  };
}

export async function deleteAmenityAction(
  amenityId: string,
): Promise<ReservationActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("amenities")
    .delete()
    .eq("id", amenityId)
    .eq("complex_id", auth.profile.complex_id);

  if (error) return { error: error.message };
  revalidateReservationPaths();
  return { success: true, message: "Zona común eliminada." };
}

export async function createReservationAction(
  _prev: ReservationActionState,
  formData: FormData,
): Promise<ReservationActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const amenityId = String(formData.get("amenityId") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();
  const startTime = String(formData.get("startTime") ?? "").trim();
  const endTime = String(formData.get("endTime") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!amenityId) return { error: "Selecciona una zona común." };

  const start = combineBogotaDateTime(date, startTime);
  const end = combineBogotaDateTime(date, endTime);
  if (!start || !end || end <= start) {
    return { error: "Fecha u horario inválidos." };
  }

  if (start.getTime() < Date.now() - 5 * 60 * 1000) {
    return { error: "No puedes reservar en el pasado." };
  }

  const { data: amenity } = await auth.supabase
    .from("amenities")
    .select(
      "id, complex_id, is_active, requires_approval, available_from, available_to, max_hours, name",
    )
    .eq("id", amenityId)
    .eq("complex_id", auth.profile.complex_id)
    .maybeSingle();

  if (!amenity?.is_active) {
    return { error: "Esa zona común no está disponible." };
  }

  const availFrom = String(amenity.available_from).slice(0, 5);
  const availTo = String(amenity.available_to).slice(0, 5);
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);
  const fromMin = timeToMinutes(availFrom);
  const toMin = timeToMinutes(availTo);
  if (
    startMin == null ||
    endMin == null ||
    fromMin == null ||
    toMin == null ||
    startMin < fromMin ||
    endMin > toMin
  ) {
    return {
      error: `Horario fuera de disponibilidad (${availFrom}–${availTo}).`,
    };
  }

  if (amenity.max_hours != null) {
    const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (hours > Number(amenity.max_hours) + 0.01) {
      return {
        error: `Máximo ${amenity.max_hours} hora(s) por reserva.`,
      };
    }
  }

  // Chequeo de conflicto en app (además del constraint DB)
  const { data: conflicts } = await auth.supabase
    .from("reservations")
    .select("id, start_time, end_time, status")
    .eq("amenity_id", amenityId)
    .in("status", ["PENDING", "CONFIRMED"])
    .lt("start_time", end.toISOString())
    .gt("end_time", start.toISOString());

  if ((conflicts ?? []).length > 0) {
    return { error: "Ese horario ya está reservado. Elige otra franja." };
  }

  const status = amenity.requires_approval ? "PENDING" : "CONFIRMED";

  const { error } = await auth.supabase.from("reservations").insert({
    amenity_id: amenityId,
    unit_id: auth.profile.unit_id,
    reserved_by: auth.user.id,
    start_time: start.toISOString(),
    end_time: end.toISOString(),
    status,
    notes: notes || null,
  });

  if (error) {
    if (error.code === "23P01" || error.message.includes("overlap")) {
      return { error: "Ese horario ya está reservado. Elige otra franja." };
    }
    return { error: error.message };
  }

  revalidateReservationPaths();
  return {
    success: true,
    message: amenity.requires_approval
      ? "Reserva enviada · pendiente de aprobación."
      : `Reserva confirmada en ${amenity.name}.`,
  };
}

export async function cancelReservationAction(
  reservationId: string,
): Promise<ReservationActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("reservations")
    .update({ status: "CANCELLED" })
    .eq("id", reservationId)
    .eq("reserved_by", auth.user.id)
    .in("status", ["PENDING", "CONFIRMED"]);

  if (error) return { error: error.message };
  revalidateReservationPaths();
  return { success: true, message: "Reserva cancelada." };
}

export async function setReservationStatusAction(params: {
  reservationId: string;
  status: "CONFIRMED" | "REJECTED";
}): Promise<ReservationActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("reservations")
    .update({ status: params.status })
    .eq("id", params.reservationId);

  if (error) {
    if (error.code === "23P01" || error.message.includes("overlap")) {
      return {
        error: "No se puede aprobar: hay conflicto de horario con otra reserva.",
      };
    }
    return { error: error.message };
  }

  revalidateReservationPaths();
  return {
    success: true,
    message:
      params.status === "CONFIRMED" ? "Reserva aprobada." : "Reserva rechazada.",
  };
}
