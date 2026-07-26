"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SettingsActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

async function requireAdminComplex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, profile: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    return {
      error: "Solo administradores pueden configurar el conjunto." as const,
      supabase,
      profile: null,
    };
  }

  return { error: null, supabase, profile };
}

export async function updateComplexSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const auth = await requireAdminComplex();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const towersRaw = String(formData.get("towers") ?? "").trim();

  if (!name) {
    return { error: "El nombre del conjunto es obligatorio." };
  }

  const towers = towersRaw
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const { error } = await auth.supabase
    .from("complexes")
    .update({
      name,
      address: address || null,
      city: city || null,
      phone: phone || null,
      email: email || null,
      description: description || null,
      logo_url: logoUrl || null,
      towers,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.profile.complex_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/settings");
  revalidatePath("/dashboard/admin");
  return { success: true, message: "Datos del conjunto actualizados." };
}

export async function addUnitAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const auth = await requireAdminComplex();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const number = String(formData.get("number") ?? "").trim();
  const tower = String(formData.get("tower") ?? "").trim();
  const floorRaw = String(formData.get("floor") ?? "").trim();

  if (!number) {
    return { error: "El número de unidad es obligatorio." };
  }

  const floor = floorRaw ? Number.parseInt(floorRaw, 10) : null;

  const { error } = await auth.supabase.from("units").insert({
    complex_id: auth.profile.complex_id,
    number,
    tower: tower || null,
    floor: Number.isFinite(floor) ? floor : null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/settings");
  return { success: true, message: "Unidad agregada." };
}

export async function addAmenityAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const auth = await requireAdminComplex();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const capacityRaw = String(formData.get("capacity") ?? "").trim();

  if (!name) {
    return { error: "El nombre de la zona común es obligatorio." };
  }

  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;

  const { error } = await auth.supabase.from("amenities").insert({
    complex_id: auth.profile.complex_id,
    name,
    description: description || null,
    location: location || null,
    capacity: Number.isFinite(capacity) ? capacity : null,
    is_active: true,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/admin/settings");
  return { success: true, message: "Zona común agregada." };
}
