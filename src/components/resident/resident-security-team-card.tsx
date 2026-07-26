import Link from "next/link";
import { Moon, Shield, Sun, UserRound } from "lucide-react";
import { GlassCard } from "@/components/ui/background-panel";
import { Badge } from "@/components/ui/badge";

export type SecurityTeamPreviewGuard = {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  shiftType: "DAY" | "NIGHT";
};

interface ResidentSecurityTeamCardProps {
  guards: SecurityTeamPreviewGuard[];
}

export function ResidentSecurityTeamCard({
  guards,
}: ResidentSecurityTeamCardProps) {
  return (
    <GlassCard as="section" padding="md">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--slate-700)]">
          <Shield className="size-4 text-[var(--brand)]" aria-hidden />
          Personal de Seguridad Hoy
        </h2>
        <Link
          href="/dashboard/resident/security-team"
          className="text-xs font-medium text-[var(--brand)] hover:underline"
        >
          Ver todos
        </Link>
      </div>

      {guards.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No hay turnos activos ahora. Revisa más tarde.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {guards.slice(0, 3).map((g) => (
            <li key={g.id} className="flex items-center gap-3">
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
                  Turno {g.shiftType === "DAY" ? "Día" : "Noche"}
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
