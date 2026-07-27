"use client";

import { useActionState, useRef } from "react";
import { Camera, MailWarning, UserRound } from "lucide-react";
import {
  requestEmailConfirmationAction,
  updateOwnProfileAction,
  uploadOwnAvatarAction,
  type ProfileActionState,
} from "@/lib/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type ResidentProfileView = {
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  emailConfirmed: boolean;
  loginCode: string | null;
  occupancyLabel: string;
  complexName: string;
  unitLabel: string;
  roleLabel: string;
};

export function ResidentProfileForm({ profile }: { profile: ResidentProfileView }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [updateState, updateAction, updating] = useActionState(
    updateOwnProfileAction,
    {} as ProfileActionState,
  );
  const [avatarState, avatarAction, uploading] = useActionState(
    uploadOwnAvatarAction,
    {} as ProfileActionState,
  );
  const [emailState, emailAction, sendingEmail] = useActionState(
    requestEmailConfirmationAction,
    {} as ProfileActionState,
  );

  return (
    <div className="space-y-5">
      {!profile.emailConfirmed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="flex items-start gap-2 font-semibold">
            <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
            Confirma tu correo cuando puedas
          </p>
          <p className="mt-1 text-amber-900/90">
            Ya puedes usar la app con normalidad. Confirmar el correo ayuda a
            recuperar la cuenta y recibir avisos del conjunto.
          </p>
          <form action={emailAction} className="mt-3">
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={sendingEmail}
            >
              {sendingEmail ? "Enviando…" : "Enviar enlace de confirmación"}
            </Button>
          </form>
          {emailState.error && (
            <p className="mt-2 text-xs text-amber-900">{emailState.error}</p>
          )}
          {emailState.success && emailState.message && (
            <p className="mt-2 text-xs text-emerald-800">{emailState.message}</p>
          )}
        </div>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <div className="relative">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                className="size-24 rounded-full object-cover ring-2 ring-[var(--border)]"
              />
            ) : (
              <span className="flex size-24 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--muted)] ring-2 ring-[var(--border)]">
                <UserRound className="size-10" aria-hidden />
              </span>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-semibold">{profile.fullName || "Tu perfil"}</h2>
            <p className="text-sm text-[var(--muted)]">{profile.email}</p>
            <form action={avatarAction} className="mt-3">
              <input
                ref={fileRef}
                type="file"
                name="avatar"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  if (e.currentTarget.files?.length) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                <Camera className="size-4" aria-hidden />
                {uploading ? "Subiendo…" : "Cambiar foto"}
              </Button>
            </form>
            {avatarState.error && (
              <p className="mt-2 text-xs text-red-700">{avatarState.error}</p>
            )}
            {avatarState.success && avatarState.message && (
              <p className="mt-2 text-xs text-emerald-800">{avatarState.message}</p>
            )}
          </div>
        </div>
      </section>

      <dl className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {[
          { label: "Conjunto", value: profile.complexName },
          { label: "Unidad", value: profile.unitLabel },
          { label: "Ocupación", value: profile.occupancyLabel },
          { label: "Usuario (unidad)", value: profile.loginCode ?? "—" },
          { label: "Rol", value: profile.roleLabel },
          {
            label: "Correo",
            value: profile.emailConfirmed
              ? `${profile.email} · confirmado`
              : `${profile.email} · pendiente`,
          },
        ].map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 px-4 py-3"
          >
            <dt className="text-sm text-[var(--muted)]">{row.label}</dt>
            <dd className="text-right text-sm font-medium text-[var(--foreground)]">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <form
        action={updateAction}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
      >
        <h2 className="font-semibold">Actualizar mis datos</h2>
        <Input
          name="fullName"
          label="Nombre y apellido"
          required
          defaultValue={profile.fullName}
        />
        <Input
          name="phone"
          label="Teléfono"
          type="tel"
          defaultValue={profile.phone}
          placeholder="300 123 4567"
        />
        {updateState.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {updateState.error}
          </p>
        )}
        {updateState.success && updateState.message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {updateState.message}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={updating}>
          {updating ? "Guardando…" : "Actualizar mis datos"}
        </Button>
      </form>
    </div>
  );
}
