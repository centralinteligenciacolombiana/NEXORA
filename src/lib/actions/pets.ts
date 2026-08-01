"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PetActionState = {
  error?: string;
  success?: boolean;
  message?: string;
  petId?: string;
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

async function uploadPetPhoto(
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
    .from("pet-photos")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) {
    return { error: `No se pudo subir la foto: ${error.message}` };
  }

  const { data } = supabase.storage.from("pet-photos").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function createPetAction(
  _prev: PetActionState,
  formData: FormData,
): Promise<PetActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const species = String(formData.get("species") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim();
  const file = formData.get("photo");

  if (!name) return { error: "El nombre es obligatorio." };
  if (!species) return { error: "Indica la especie o tipo." };

  let photoUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const up = await uploadPetPhoto(
      auth.supabase,
      auth.profile.complex_id,
      auth.profile.unit_id,
      file,
    );
    if (up.error) return { error: up.error };
    photoUrl = up.url ?? null;
  }

  const { data, error } = await auth.supabase
    .from("pets")
    .insert({
      unit_id: auth.profile.unit_id,
      name,
      species,
      breed: breed || null,
      photo_url: photoUrl,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/pets");
  revalidatePath("/dashboard/admin/pets");
  return { success: true, message: "Mascota registrada.", petId: data.id };
}

export async function updatePetAction(
  _prev: PetActionState,
  formData: FormData,
): Promise<PetActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const id = String(formData.get("petId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const species = String(formData.get("species") ?? "").trim();
  const breed = String(formData.get("breed") ?? "").trim();
  const file = formData.get("photo");

  if (!id) return { error: "Mascota no válida." };
  if (!name) return { error: "El nombre es obligatorio." };
  if (!species) return { error: "Indica la especie o tipo." };

  const patch: Record<string, unknown> = {
    name,
    species,
    breed: breed || null,
  };

  if (file instanceof File && file.size > 0) {
    const up = await uploadPetPhoto(
      auth.supabase,
      auth.profile.complex_id,
      auth.profile.unit_id,
      file,
    );
    if (up.error) return { error: up.error };
    patch.photo_url = up.url ?? null;
  }

  const { error } = await auth.supabase
    .from("pets")
    .update(patch)
    .eq("id", id)
    .eq("unit_id", auth.profile.unit_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/pets");
  revalidatePath("/dashboard/admin/pets");
  return { success: true, message: "Mascota actualizada." };
}

export async function deletePetAction(petId: string): Promise<PetActionState> {
  const auth = await requireResidentWithUnit();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("pets")
    .delete()
    .eq("id", petId)
    .eq("unit_id", auth.profile.unit_id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident/pets");
  revalidatePath("/dashboard/admin/pets");
  return { success: true, message: "Mascota eliminada." };
}
