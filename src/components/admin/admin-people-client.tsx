"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  Moon,
  Search,
  Shield,
  Sun,
  UserRound,
  Wrench,
} from "lucide-react";
import { annulMemberAction } from "@/lib/actions/invites";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/background-panel";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

export type AdminPeopleMember = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: UserRole;
  roleLabel: string;
  unitLabel: string | null;
  occupancyLabel: string | null;
  registrationStatus: "PENDING" | "APPROVED" | "REJECTED";
  isActive: boolean;
  loginCode: string | null;
  createdAtLabel: string;
  /** Solo SECURITY */
  activeShift: "DAY" | "NIGHT" | null;
};

type RoleFilter = "ALL" | UserRole;
type StatusFilter = "ALL" | "APPROVED" | "PENDING" | "REJECTED";

const ROLE_TABS: { id: RoleFilter; label: string }[] = [
  { id: "ALL", label: "Todos" },
  { id: "RESIDENT", label: "Residentes" },
  { id: "SECURITY", label: "Seguridad" },
  { id: "STAFF", label: "Mantenimiento" },
  { id: "ADMIN", label: "Admins" },
];

function RoleIcon({ role }: { role: UserRole }) {
  if (role === "SECURITY") return <Shield className="size-5" aria-hidden />;
  if (role === "STAFF") return <Wrench className="size-5" aria-hidden />;
  return <UserRound className="size-5" aria-hidden />;
}

function statusBadge(status: AdminPeopleMember["registrationStatus"]) {
  if (status === "APPROVED") return <Badge variant="success">Activo</Badge>;
  if (status === "PENDING") return <Badge variant="warning">Pendiente</Badge>;
  return <Badge variant="danger">Rechazado</Badge>;
}

export function AdminPeopleClient({
  members,
  counts,
}: {
  members: AdminPeopleMember[];
  counts: {
    total: number;
    residents: number;
    security: number;
    staff: number;
    onDuty: number;
    pending: number;
  };
}) {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("APPROVED");
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [annullingId, setAnnullingId] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((m) => {
      if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
      if (statusFilter !== "ALL" && m.registrationStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone?.toLowerCase().includes(q) ?? false) ||
        (m.unitLabel?.toLowerCase().includes(q) ?? false) ||
        (m.loginCode?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [members, roleFilter, statusFilter, query]);

  return (
    <div className="space-y-4">
      {feedback ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {feedback}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total", value: counts.total },
          { label: "Residentes", value: counts.residents },
          { label: "Seguridad", value: counts.security },
          { label: "Mantenimiento", value: counts.staff },
          { label: "En turno", value: counts.onDuty },
          { label: "Por aprobar", value: counts.pending },
        ].map((c) => (
          <GlassCard key={c.label} padding="sm" className="text-center">
            <p className="text-xs text-[var(--muted)]">{c.label}</p>
            <p className="mt-0.5 font-display text-xl font-semibold">{c.value}</p>
          </GlassCard>
        ))}
      </div>

      <p className="text-xs text-[var(--muted)]">
        Los turnos en vivo están arriba.{" "}
        <Link
          href="/dashboard/admin/settings/security"
          className="font-medium text-[var(--brand)] hover:underline"
        >
          Gestionar turnos
        </Link>
        {" · "}
        <Link
          href="/dashboard/admin/security-reports"
          className="font-medium text-[var(--brand)] hover:underline"
        >
          Reportes de cierre
        </Link>
      </p>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setRoleFilter(tab.id)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              roleFilter === tab.id
                ? "bg-[var(--brand)] text-white"
                : "bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="peopleSearch" className="text-sm font-medium">
            Buscar
          </label>
          <div className="relative mt-1.5">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted)]"
              aria-hidden
            />
            <input
              id="peopleSearch"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre, email, apto, teléfono…"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-44">
          <label htmlFor="statusFilter" className="text-sm font-medium">
            Estado
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="min-h-11 w-full rounded-lg border border-black/10 bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          >
            <option value="APPROVED">Activos</option>
            <option value="PENDING">Pendientes</option>
            <option value="ALL">Todos los estados</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] px-4 py-12 text-center text-sm text-[var(--muted)]">
          No hay personas con esos filtros.
          {statusFilter === "PENDING" ? (
            <>
              {" "}
              <Link
                href="/dashboard/admin/approvals"
                className="font-medium text-[var(--brand)] hover:underline"
              >
                Ir a confirmar altas
              </Link>
            </>
          ) : null}
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((m) => (
            <li key={m.id}>
              <GlassCard as="article" padding="md">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                    <RoleIcon role={m.role} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{m.fullName}</p>
                      {statusBadge(m.registrationStatus)}
                      {!m.isActive ? (
                        <Badge variant="muted">Inactivo</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-[var(--muted)]">
                      {m.roleLabel}
                      {m.unitLabel ? ` · ${m.unitLabel}` : ""}
                      {m.occupancyLabel ? ` · ${m.occupancyLabel}` : ""}
                    </p>
                    <dl className="mt-2 grid gap-1 text-sm text-[var(--slate-700)] sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Correo</dt>
                        <dd className="truncate font-medium">{m.email}</dd>
                      </div>
                      {m.phone ? (
                        <div>
                          <dt className="text-xs text-[var(--muted)]">Teléfono</dt>
                          <dd className="font-medium">{m.phone}</dd>
                        </div>
                      ) : null}
                      {m.loginCode ? (
                        <div>
                          <dt className="text-xs text-[var(--muted)]">Usuario</dt>
                          <dd className="font-mono text-sm font-medium">
                            {m.loginCode}
                          </dd>
                        </div>
                      ) : null}
                      <div>
                        <dt className="text-xs text-[var(--muted)]">Alta</dt>
                        <dd className="text-sm">{m.createdAtLabel}</dd>
                      </div>
                    </dl>

                    {m.role === "SECURITY" && (
                      <div className="mt-2">
                        {m.activeShift === "DAY" && (
                          <Badge variant="warning">
                            <Sun className="mr-1 size-3" aria-hidden />
                            En turno · Día
                          </Badge>
                        )}
                        {m.activeShift === "NIGHT" && (
                          <Badge variant="muted">
                            <Moon className="mr-1 size-3" aria-hidden />
                            En turno · Noche
                          </Badge>
                        )}
                        {!m.activeShift && (
                          <Badge variant="muted">Sin turno activo</Badge>
                        )}
                      </div>
                    )}

                    {m.role === "STAFF" && (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        Personal de mantenimiento del conjunto.
                      </p>
                    )}

                    {m.registrationStatus === "PENDING" && (
                      <Link
                        href="/dashboard/admin/approvals"
                        className="mt-2 inline-block text-xs font-medium text-[var(--brand)] hover:underline"
                      >
                        Revisar en Confirmación de altas →
                      </Link>
                    )}

                    {m.registrationStatus === "APPROVED" &&
                      m.role !== "ADMIN" &&
                      m.isActive && (
                        <div className="mt-3">
                          {annullingId === m.id ? (
                            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                              <label className="block text-sm font-medium text-red-900">
                                Motivo de anulación
                                <textarea
                                  value={annulReason}
                                  onChange={(e) =>
                                    setAnnulReason(e.target.value)
                                  }
                                  rows={2}
                                  maxLength={500}
                                  className="mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm outline-none"
                                  placeholder="Ej. Ya no reside / se retiró del personal"
                                />
                              </label>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={pending}
                                  onClick={() =>
                                    startTransition(async () => {
                                      setFeedback(null);
                                      setError(null);
                                      const result = await annulMemberAction(
                                        m.id,
                                        annulReason,
                                      );
                                      if (result.error) {
                                        setError(result.error);
                                        return;
                                      }
                                      setFeedback(
                                        result.message ?? "Miembro anulado.",
                                      );
                                      setAnnullingId(null);
                                      setAnnulReason("");
                                    })
                                  }
                                >
                                  Confirmar borrado
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={pending}
                                  onClick={() => {
                                    setAnnullingId(null);
                                    setAnnulReason("");
                                  }}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="text-xs font-medium text-red-700 hover:underline"
                              onClick={() => {
                                setAnnullingId(m.id);
                                setAnnulReason("");
                                setError(null);
                              }}
                            >
                              Anular registro y borrar cuenta
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              </GlassCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
