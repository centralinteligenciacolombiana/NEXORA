"use client";

import { useEffect, useState } from "react";
import { Moon, Shield, Sun, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { GlassCard } from "@/components/ui/background-panel";
import { Badge } from "@/components/ui/badge";
import {
  SECURITY_POST_LABELS,
  type SecurityPost,
} from "@/lib/security";

export type OnDutyGuardView = {
  shiftId: string;
  guardId: string;
  fullName: string;
  avatarUrl: string | null;
  shiftType: "DAY" | "NIGHT";
  post: SecurityPost | null;
  startedAt: string;
};

interface OnDutySecurityLiveProps {
  complexId: string;
  initialGuards: OnDutyGuardView[];
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
}

export function OnDutySecurityLive({
  complexId,
  initialGuards,
  title = "Seguridad en turno ahora",
  emptyMessage = "Nadie marcado en turno en este momento.",
  compact = false,
}: OnDutySecurityLiveProps) {
  const [guards, setGuards] = useState(initialGuards);

  useEffect(() => {
    setGuards(initialGuards);
  }, [initialGuards]);

  useEffect(() => {
    const supabase = createClient();

    async function refresh() {
      const { data: shifts } = await supabase
        .from("guard_shifts")
        .select("id, guard_id, shift_type, post_assignment, started_at")
        .eq("complex_id", complexId)
        .eq("status", "ACTIVE")
        .order("started_at", { ascending: true });

      if (!shifts?.length) {
        setGuards([]);
        return;
      }

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

      setGuards(
        shifts.map((s) => {
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
        }),
      );
    }

    const channel = supabase
      .channel(`guard_shifts_live_${complexId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "guard_shifts",
          filter: `complex_id=eq.${complexId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [complexId]);

  return (
    <GlassCard as="section" padding={compact ? "sm" : "md"}>
      <div className="flex items-center gap-2">
        <Shield className="size-4 text-[var(--brand)]" aria-hidden />
        <h2 className="text-sm font-semibold text-[var(--slate-700)]">{title}</h2>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
          <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
          En vivo
        </span>
      </div>

      {guards.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {guards.map((g) => (
            <li key={g.shiftId} className="flex items-center gap-3">
              {g.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={g.avatarUrl}
                  alt=""
                  className="size-11 rounded-full object-cover"
                />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--muted)]">
                  <UserRound className="size-5" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{g.fullName}</p>
                <p className="text-xs text-[var(--muted)]">
                  {g.post ? SECURITY_POST_LABELS[g.post] : "Puesto no indicado"}
                </p>
              </div>
              <Badge variant={g.shiftType === "DAY" ? "warning" : "muted"}>
                {g.shiftType === "DAY" ? (
                  <Sun className="size-3" aria-hidden />
                ) : (
                  <Moon className="size-3" aria-hidden />
                )}
                {g.shiftType === "DAY" ? "Día" : "Noche"}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
