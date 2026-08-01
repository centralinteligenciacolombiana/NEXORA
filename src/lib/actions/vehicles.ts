"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  formatPlateDisplay,
  isValidPlate,
  normalizePlate,
  type VehicleType,
} from "@/lib/vehicles";

export type VehicleActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  vehicleId?: string;
};

export type VehicleLookupState = {
  error?: string;
  success?: boolean;
  found?: boolean;
  plate?: string;
  vehicleType?: string;
  color?: string | null;
  unitLabel?: string;
  photoUrl?: string | null;
  notes?: string | null;
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
    profile.registration_status === "PENDING" ||
    profile.registration_status === "REJECTED"
  ) {
    return {
      error: "Solo residentes autorizados." as const,
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

function parseVehicleType(raw: string): VehicleType | null {
  if (raw === "CAR" || raw === "MOTORCYCLE") return raw;
  return null;
}

async function uploadVehiclePhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  complexId: string,
  unitId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return { error: "La foto debe ser JPG, PNG, WebP o GIF." };
  }
  if (file.size > 3 * 1024 * 1024) {
    return { error: "La foto no puede superar 3 MB." };
  }

  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
        ? "webp"
        : file.type === "image/gif"
          ? "gif"
          : "jpg";

  const path = `${complexId}/${unitId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("vehicle-photos")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) {
    return { error: `No se pudo subir la foto: ${error.message}` };
  }

  const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function createAuthorizedVehicleAction(
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const plateRaw = String(formData.get("plate") ?? "");
  const vehicleType = parseVehicleType(String(formData.get("vehicleType") ?? ""));
  const color = String(formData.get("color") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("photo");

  if (!isValidPlate(plateRaw)) {
    return { error: "Ingresa una placa válida (5–12 caracteres)." };
  }
  if (!vehicleType) {
    return { error: "Selecciona el tipo de vehículo." };
  }

  const plateNormalized = normalizePlate(plateRaw);
  const plate = formatPlateDisplay(plateRaw);

  let photoUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const up = await uploadVehiclePhoto(
      auth.supabase,
      auth.profile.complex_id,
      auth.profile.unit_id,
      file,
    );
    if (up.error) return { error: up.error };
    photoUrl = up.url ?? null;
  }

  const { data, error } = await auth.supabase
    .from("authorized_vehicles")
    .insert({
      complex_id: auth.profile.complex_id,
      unit_id: auth.profile.unit_id,
      created_by: auth.user.id,
      plate,
      plate_normalized: plateNormalized,
      vehicle_type: vehicleType,
      color: color || null,
      notes: notes || null,
      photo_url: photoUrl,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Esa placa ya está registrada en el conjunto." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/vehicles");
  revalidatePath("/dashboard/security/vehicles");
  return {
    success: true,
    message: "Vehículo registrado.",
    vehicleId: data.id,
  };
}

export async function updateAuthorizedVehicleAction(
  _prev: VehicleActionState,
  formData: FormData,
): Promise<VehicleActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const id = String(formData.get("vehicleId") ?? "").trim();
  const plateRaw = String(formData.get("plate") ?? "");
  const vehicleType = parseVehicleType(String(formData.get("vehicleType") ?? ""));
  const color = String(formData.get("color") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const file = formData.get("photo");

  if (!id) return { error: "Vehículo no válido." };
  if (!isValidPlate(plateRaw)) {
    return { error: "Ingresa una placa válida (5–12 caracteres)." };
  }
  if (!vehicleType) {
    return { error: "Selecciona el tipo de vehículo." };
  }

  const plateNormalized = normalizePlate(plateRaw);
  const plate = formatPlateDisplay(plateRaw);

  const patch: Record<string, unknown> = {
    plate,
    plate_normalized: plateNormalized,
    vehicle_type: vehicleType,
    color: color || null,
    notes: notes || null,
  };

  if (file instanceof File && file.size > 0) {
    const up = await uploadVehiclePhoto(
      auth.supabase,
      auth.profile.complex_id,
      auth.profile.unit_id,
      file,
    );
    if (up.error) return { error: up.error };
    patch.photo_url = up.url ?? null;
  }

  const { error } = await auth.supabase
    .from("authorized_vehicles")
    .update(patch)
    .eq("id", id)
    .eq("unit_id", auth.profile.unit_id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Esa placa ya está registrada en el conjunto." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/vehicles");
  revalidatePath("/dashboard/security/vehicles");
  return { success: true, message: "Vehículo actualizado." };
}

export async function deleteAuthorizedVehicleAction(
  vehicleId: string,
): Promise<VehicleActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("authorized_vehicles")
    .delete()
    .eq("id", vehicleId)
    .eq("unit_id", auth.profile.unit_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/vehicles");
  revalidatePath("/dashboard/security/vehicles");
  return { success: true, message: "Vehículo eliminado." };
}

/** Búsqueda rápida de placa (seguridad / admin). */
export async function lookupAuthorizedVehicleAction(
  _prev: VehicleLookupState,
  formData: FormData,
): Promise<VehicleLookupState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Debes iniciar sesión." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile?.complex_id ||
    (profile.role !== "SECURITY" && profile.role !== "ADMIN")
  ) {
    return { error: "Solo seguridad o administración." };
  }

  const plateRaw = String(formData.get("plate") ?? "");
  const plateNormalized = normalizePlate(plateRaw);
  if (plateNormalized.length < 3) {
    return { error: "Escribe al menos 3 caracteres de la placa." };
  }

  const { data: rows, error } = await supabase
    .from("authorized_vehicles")
    .select(
      "id, plate, plate_normalized, vehicle_type, color, photo_url, notes, unit_id, is_active",
    )
    .eq("complex_id", profile.complex_id)
    .eq("is_active", true)
    .ilike("plate_normalized", `%${plateNormalized}%`)
    .limit(5);

  if (error) {
    return { error: error.message };
  }

  if (!rows?.length) {
    return {
      success: true,
      found: false,
      plate: formatPlateDisplay(plateRaw),
      message: "Placa no autorizada en este conjunto.",
    };
  }

  const exact =
    rows.find((r) => r.plate_normalized === plateNormalized) ?? rows[0]!;

  const { data: unit } = await supabase
    .from("units")
    .select("number, tower")
    .eq("id", exact.unit_id)
    .maybeSingle();

  const unitLabel = unit
    ? [unit.tower, `Apto ${unit.number}`].filter(Boolean).join(" · ")
    : "Unidad";

  return {
    success: true,
    found: true,
    plate: exact.plate,
    vehicleType: exact.vehicle_type,
    color: exact.color,
    photoUrl: exact.photo_url,
    notes: exact.notes,
    unitLabel,
    message:
      rows.length > 1
        ? `Coincidencia principal de ${rows.length} resultados.`
        : "Vehículo autorizado.",
  };
}
