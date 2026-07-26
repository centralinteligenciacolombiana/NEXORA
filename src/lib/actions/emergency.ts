"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type EmergencyActionState = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function triggerPanicAlertAction(
  _prev: EmergencyActionState,
  _formData: FormData,
): Promise<EmergencyActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Debes iniciar sesión." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, unit_id, complex_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return { error: "Perfil no encontrado." };
  }

  if (profile.role !== "RESIDENT") {
    return { error: "Solo los residentes pueden enviar la alerta de pánico." };
  }

  if (!profile.unit_id || !profile.complex_id) {
    return {
      error: "No tienes una unidad asignada para enviar la alerta.",
    };
  }

  const { error } = await supabase.from("emergency_alerts").insert({
    unit_id: profile.unit_id,
    triggered_by: user.id,
    alert_type: "PANIC",
    status: "ACTIVE",
    notes: "Alerta de pánico enviada desde el panel del residente",
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/resident");
  return {
    success: true,
    message: "Alerta enviada a portería. El personal ya fue notificado.",
  };
}
