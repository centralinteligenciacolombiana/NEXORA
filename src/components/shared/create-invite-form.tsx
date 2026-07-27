"use client";

import { useActionState, useCallback, useEffect, useState } from "react";
import { Link2, Plus, Shield, Home, Wrench } from "lucide-react";
import {
  createInviteAction,
  type InviteActionState,
} from "@/lib/actions/invites";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast, useToast } from "@/components/ui/toast";
import { InviteQrCard } from "@/components/shared/invite-qr-card";
import type { UserRole } from "@/types";

type InviteRole = Extract<UserRole, "RESIDENT" | "SECURITY" | "STAFF">;

const ROLE_OPTIONS: {
  value: InviteRole;
  label: string;
  description: string;
  defaultLabel: string;
  icon: typeof Home;
}[] = [
  {
    value: "RESIDENT",
    label: "Residentes",
    description: "Registro con torre/apto. Van al panel de residente.",
    defaultLabel: "Registro de residentes",
    icon: Home,
  },
  {
    value: "SECURITY",
    label: "Seguridad",
    description: "Portería y vigilancia. Van al panel de seguridad.",
    defaultLabel: "Registro de seguridad",
    icon: Shield,
  },
  {
    value: "STAFF",
    label: "Mantenimiento",
    description: "Personal de mantenimiento. Van al panel de staff.",
    defaultLabel: "Registro de mantenimiento",
    icon: Wrench,
  },
];

/**
 * Genera link/QR del conjunto eligiendo el rol del enlace.
 */
export function CreateInviteForm() {
  const [role, setRole] = useState<InviteRole>("RESIDENT");
  const [label, setLabel] = useState(ROLE_OPTIONS[0]!.defaultLabel);
  const [state, formAction, pending] = useActionState(
    createInviteAction,
    {} as InviteActionState,
  );
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [lastRoleLabel, setLastRoleLabel] = useState<string | null>(null);
  const { toast, showToast, dismissToast } = useToast();

  const onDismiss = useCallback(() => {
    dismissToast();
  }, [dismissToast]);

  useEffect(() => {
    if (!state.success || !state.url) return;
    setLastUrl(state.url);
    setLastRoleLabel(
      ROLE_OPTIONS.find((o) => o.value === role)?.label ?? "invitación",
    );
    showToast(
      state.message ?? "Enlace y QR listos para compartir",
      "success",
    );
  }, [state, showToast, role]);

  function selectRole(next: InviteRole) {
    setRole(next);
    const option = ROLE_OPTIONS.find((o) => o.value === next);
    if (option) {
      setLabel(option.defaultLabel);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/5 bg-[var(--surface)] p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-[var(--brand)]/10 p-2 text-[var(--brand)]">
            <Plus className="size-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-[var(--foreground)]">
              Nueva invitación
            </h2>
            <p className="mt-0.5 text-sm text-[var(--muted)]">
              Elige para quién es el enlace. El formulario de registro y el
              panel destino cambian según el tipo.
            </p>
          </div>
        </div>

        <form action={formAction} className="mt-4 space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Tipo de enlace</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const selected = role === option.value;
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition-colors ${
                      selected
                        ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                        : "border-[var(--border)] hover:border-black/20"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="role"
                        value={option.value}
                        checked={selected}
                        onChange={() => selectRole(option.value)}
                        className="sr-only"
                      />
                      <Icon
                        className="size-4 text-[var(--brand)]"
                        aria-hidden
                      />
                      <span className="text-sm font-semibold">
                        {option.label}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {option.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <Input
            name="label"
            label="Nombre del enlace (opcional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej. Registro de seguridad"
            maxLength={80}
          />

          <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
            <Link2 className="size-4" aria-hidden />
            {pending ? "Generando…" : "Generar enlace y QR"}
          </Button>
        </form>

        {state.error && !state.success && (
          <p
            className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            role="alert"
          >
            {state.error}
          </p>
        )}
      </div>

      {lastUrl && (
        <InviteQrCard
          url={lastUrl}
          title={
            lastRoleLabel
              ? `QR listo — ${lastRoleLabel}`
              : "QR listo para compartir o imprimir"
          }
        />
      )}

      <Toast
        message={toast?.message ?? null}
        variant={toast?.variant}
        onDismiss={onDismiss}
      />
    </div>
  );
}
