"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/projects-voting";
import { isPollOpen } from "@/lib/projects-voting";

export type ProjectVotingActionState = {
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
    return { error: "Debes iniciar sesión." as const, supabase, profile: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    return { error: "Solo administradores." as const, supabase, profile: null, user: null };
  }

  return { error: null, supabase, profile, user };
}

async function requireResident() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." as const, supabase, profile: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id, unit_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    return { error: "Solo residentes." as const, supabase, profile: null, user: null };
  }

  return { error: null, supabase, profile, user };
}

function revalidateProjects() {
  revalidatePath("/dashboard/admin/projects");
  revalidatePath("/dashboard/resident/projects");
  revalidatePath("/dashboard/resident");
}

function revalidateVoting() {
  revalidatePath("/dashboard/admin/voting");
  revalidatePath("/dashboard/resident/voting");
  revalidatePath("/dashboard/resident");
}

async function uploadProjectCover(
  supabase: Awaited<ReturnType<typeof createClient>>,
  complexId: string,
  file: File,
): Promise<{ url?: string; error?: string }> {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return { error: "La portada debe ser JPG, PNG o WebP." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { error: "La imagen no puede superar 5 MB." };
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${complexId}/${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from("project-covers")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return { error: error.message };

  const { data } = supabase.storage.from("project-covers").getPublicUrl(path);
  return { url: data.publicUrl };
}

export async function upsertProjectAction(
  _prev: ProjectVotingActionState,
  formData: FormData,
): Promise<ProjectVotingActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "PROPOSED") as ProjectStatus;
  const yearRaw = String(formData.get("year") ?? "").trim();
  const budgetRaw = String(formData.get("budget") ?? "").trim();
  const file = formData.get("cover");

  if (!title) return { error: "El título es obligatorio." };

  const year = Number.parseInt(yearRaw, 10);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return { error: "Año inválido." };
  }

  if (!["PROPOSED", "IN_PROGRESS", "COMPLETED"].includes(status)) {
    return { error: "Estado inválido." };
  }

  let budget: number | null = null;
  if (budgetRaw) {
    const n = Number.parseFloat(budgetRaw.replace(/,/g, "."));
    if (!Number.isFinite(n) || n < 0) return { error: "Presupuesto inválido." };
    budget = n;
  }

  let coverUrl: string | null | undefined;
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadProjectCover(
      auth.supabase,
      auth.profile.complex_id,
      file,
    );
    if (uploaded.error) return { error: uploaded.error };
    coverUrl = uploaded.url ?? null;
  }

  const payload: Record<string, unknown> = {
    title,
    description: description || null,
    status,
    year,
    budget,
    updated_at: new Date().toISOString(),
  };

  if (coverUrl !== undefined) {
    payload.cover_image_url = coverUrl;
  }

  if (projectId) {
    const { error } = await auth.supabase
      .from("complex_projects")
      .update(payload)
      .eq("id", projectId)
      .eq("complex_id", auth.profile.complex_id);

    if (error) return { error: error.message };
    revalidateProjects();
    return { success: true, message: "Proyecto actualizado." };
  }

  const { error } = await auth.supabase.from("complex_projects").insert({
    ...payload,
    complex_id: auth.profile.complex_id,
    created_by: auth.user.id,
  });

  if (error) return { error: error.message };
  revalidateProjects();
  return { success: true, message: "Proyecto creado." };
}

export async function deleteProjectAction(
  projectId: string,
): Promise<ProjectVotingActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("complex_projects")
    .delete()
    .eq("id", projectId)
    .eq("complex_id", auth.profile.complex_id);

  if (error) return { error: error.message };
  revalidateProjects();
  return { success: true, message: "Proyecto eliminado." };
}

export async function createPollAction(
  _prev: ProjectVotingActionState,
  formData: FormData,
): Promise<ProjectVotingActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const endsAtRaw = String(formData.get("endsAt") ?? "").trim();
  const optionsRaw = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);

  if (!title) return { error: "El título es obligatorio." };
  if (optionsRaw.length < 2) {
    return { error: "Agrega al menos 2 opciones (una por línea)." };
  }

  let endsAt: string | null = null;
  if (endsAtRaw) {
    const d = new Date(endsAtRaw);
    if (Number.isNaN(d.getTime())) return { error: "Fecha de cierre inválida." };
    endsAt = d.toISOString();
  }

  const { data: poll, error } = await auth.supabase
    .from("polls")
    .insert({
      complex_id: auth.profile.complex_id,
      title,
      description: description || null,
      status: "ACTIVE",
      starts_at: new Date().toISOString(),
      ends_at: endsAt,
      created_by: auth.user.id,
    })
    .select("id")
    .single();

  if (error || !poll) {
    return { error: error?.message ?? "No se pudo crear la encuesta." };
  }

  const optionRows = optionsRaw.map((option_text, i) => ({
    poll_id: poll.id,
    option_text,
    sort_order: i,
  }));

  const { error: optError } = await auth.supabase
    .from("poll_options")
    .insert(optionRows);

  if (optError) {
    await auth.supabase.from("polls").delete().eq("id", poll.id);
    return { error: optError.message };
  }

  revalidateVoting();
  return { success: true, message: "Encuesta publicada." };
}

export async function closePollAction(
  pollId: string,
): Promise<ProjectVotingActionState> {
  const auth = await requireAdmin();
  if (auth.error || !auth.profile) {
    return { error: auth.error ?? "No autorizado." };
  }

  const { error } = await auth.supabase
    .from("polls")
    .update({
      status: "CLOSED",
      ends_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", pollId)
    .eq("complex_id", auth.profile.complex_id);

  if (error) return { error: error.message };
  revalidateVoting();
  return { success: true, message: "Votación cerrada." };
}

export async function castVoteAction(
  _prev: ProjectVotingActionState,
  formData: FormData,
): Promise<ProjectVotingActionState> {
  const auth = await requireResident();
  if (auth.error || !auth.profile || !auth.user) {
    return { error: auth.error ?? "No autorizado." };
  }

  if (!auth.profile.unit_id) {
    return { error: "Necesitas una unidad asignada para votar." };
  }

  const pollId = String(formData.get("pollId") ?? "").trim();
  const optionId = String(formData.get("optionId") ?? "").trim();

  if (!pollId || !optionId) {
    return { error: "Selecciona una opción." };
  }

  const { data: poll } = await auth.supabase
    .from("polls")
    .select("id, status, starts_at, ends_at, complex_id")
    .eq("id", pollId)
    .eq("complex_id", auth.profile.complex_id)
    .maybeSingle();

  if (!poll) return { error: "Encuesta no encontrada." };
  if (!isPollOpen(poll)) {
    return { error: "Esta votación ya no está abierta." };
  }

  const { data: option } = await auth.supabase
    .from("poll_options")
    .select("id")
    .eq("id", optionId)
    .eq("poll_id", pollId)
    .maybeSingle();

  if (!option) return { error: "Opción inválida." };

  const { error } = await auth.supabase.from("poll_votes").insert({
    poll_id: pollId,
    option_id: optionId,
    user_id: auth.user.id,
    unit_id: auth.profile.unit_id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Tu unidad ya emitió un voto en esta encuesta." };
    }
    return { error: error.message };
  }

  revalidateVoting();
  return { success: true, message: "Voto registrado. Gracias por participar." };
}
