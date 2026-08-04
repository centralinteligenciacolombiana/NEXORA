"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  registerWithInviteAction,
  type AuthActionState,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MailCheck } from "lucide-react";

interface InviteRegisterFormProps {
  token: string;
  role: string;
  lockedEmail?: string | null;
  defaultFullName?: string;
  /** Solo residentes declaran apto / ocupación */
  requireUnit: boolean;
  complexName?: string;
}

export function InviteRegisterForm({
  token,
  role,
  lockedEmail,
  defaultFullName = "",
  requireUnit,
  complexName,
}: InviteRegisterFormProps) {
  const [state, formAction, pending] = useActionState(
    registerWithInviteAction,
    {} as AuthActionState,
  );

  if (state.success && state.message) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[var(--surface)] text-emerald-700">
          <MailCheck className="size-6" aria-hidden />
        </div>
        <h3 className="mt-3 font-display text-lg font-semibold text-emerald-950">
          Revisa tu correo
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-emerald-900">
          {state.message}
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-4 text-sm font-medium text-white"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="role" value={role} />

      {complexName && (
        <p className="rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-sm text-[var(--brand)]">
          Te unirás a <strong>{complexName}</strong>
        </p>
      )}

      <Input
        name="fullName"
        label="Nombre y apellido"
        type="text"
        required
        autoComplete="name"
        defaultValue={defaultFullName}
        placeholder="Juan Pérez"
      />

      <Input
        name="email"
        label="Correo electrónico"
        type="email"
        autoComplete="email"
        required
        defaultValue={lockedEmail ?? undefined}
        readOnly={Boolean(lockedEmail)}
        placeholder="tu@email.com"
        className={
          lockedEmail
            ? "cursor-not-allowed bg-black/[0.03] text-[var(--muted)]"
            : undefined
        }
      />
      {lockedEmail ? (
        <p className="-mt-2 text-xs text-[var(--muted)]">
          Este correo está vinculado a la invitación y no se puede cambiar.
        </p>
      ) : (
        <p className="-mt-2 text-xs text-[var(--muted)]">
          Entras de inmediato al panel. Más adelante podrás confirmar el correo
          desde tu perfil.
        </p>
      )}

      {requireUnit && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="tower"
              label="Torre / bloque"
              type="text"
              placeholder="Torre A / Bloque 2"
              autoComplete="off"
            />
            <Input
              name="unitNumber"
              label="Apartamento / casa"
              type="text"
              required
              placeholder="501"
              autoComplete="off"
            />
          </div>
          <p className="-mt-2 text-xs text-[var(--muted)]">
            Tú indicas tu dirección dentro del conjunto. Luego podrás entrar con
            el correo o con tu unidad (ej. TorreA-501).
          </p>

          <Select
            name="occupancyType"
            label="¿Cómo ocupas la vivienda?"
            required
            defaultValue=""
          >
            <option value="" disabled>
              Selecciona una opción
            </option>
            <option value="OWNER">Soy propietario</option>
            <option value="TENANT">Estoy en arriendo</option>
            <option value="TEMPORARY">Ocupación temporal</option>
          </Select>
        </>
      )}

      {!requireUnit && (
        <p className="rounded-lg bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)]">
          {role === "SECURITY"
            ? "Te registrarás como seguridad. Tras la confirmación del administrador entrarás al panel de vigilancia."
            : role === "STAFF"
              ? "Te registrarás como personal de mantenimiento. Tras la confirmación del administrador entrarás al panel de staff."
              : "Completa tus datos para unirte al conjunto."}
        </p>
      )}

      {role === "SECURITY" && (
        <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-3">
          <p className="text-sm font-semibold">Datos de turno (opcionales)</p>
          <p className="-mt-1 text-xs text-[var(--muted)]">
            Puedes indicar tu horario habitual. Luego lo confirmarás al marcar
            entrada de turno.
          </p>
          <Select name="preferredShift" label="Turno habitual" defaultValue="">
            <option value="">Sin indicar</option>
            <option value="DAY">Día</option>
            <option value="NIGHT">Noche</option>
          </Select>
          <Select name="securityPost" label="Puesto habitual" defaultValue="">
            <option value="">Sin indicar</option>
            <option value="LOBBY">Lobby / recepción</option>
            <option value="PATROL">Patrullaje</option>
            <option value="MIXED">Mixto</option>
          </Select>
          <Input
            name="securityNotes"
            label="Horario u observaciones"
            placeholder="Ej. Lun–Vie 6:00–18:00, relevo en lobby"
            maxLength={200}
          />
        </div>
      )}

      <Input
        name="password"
        label="Contraseña"
        type="password"
        autoComplete="new-password"
        required
        placeholder="Mínimo 8 caracteres"
      />

      <Input
        name="passwordConfirm"
        label="Confirmar contraseña"
        type="password"
        autoComplete="new-password"
        required
        placeholder="Repite tu contraseña"
      />

      {state.error && (
        <p
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creando cuenta…" : "Unirme al conjunto"}
      </Button>
    </form>
  );
}
