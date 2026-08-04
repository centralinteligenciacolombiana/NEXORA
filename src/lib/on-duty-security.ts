import type { SupabaseClient } from "@supabase/supabase-js";
import type { OnDutyGuardView } from "@/components/shared/on-duty-security-live";
import type { SecurityPost } from "@/lib/security";

/** Carga turnos ACTIVE con perfil, para SSR + seed del componente live. */
export async function fetchOnDutyGuards(
  supabase: SupabaseClient,
  complexId: string,
): Promise<OnDutyGuardView[]> {
  const { data: shifts } = await supabase
    .from("guard_shifts")
    .select("id, guard_id, shift_type, post_assignment, started_at")
    .eq("complex_id", complexId)
    .eq("status", "ACTIVE")
    .order("started_at", { ascending: true });

  if (!shifts?.length) return [];

  const ids = [...new Set(shifts.map((s) => s.guard_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", ids);

  const byId = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      {
        fullName: p.full_name?.trim() || "Personal de seguridad",
        avatarUrl: p.avatar_url as string | null,
      },
    ]),
  );

  return shifts.map((s) => {
    const p = byId.get(s.guard_id);
    return {
      shiftId: s.id,
      guardId: s.guard_id,
      fullName: p?.fullName ?? "Personal de seguridad",
      avatarUrl: p?.avatarUrl ?? null,
      shiftType: s.shift_type as "DAY" | "NIGHT",
      post: (s.post_assignment as SecurityPost | null) ?? null,
      startedAt: s.started_at,
    };
  });
}
