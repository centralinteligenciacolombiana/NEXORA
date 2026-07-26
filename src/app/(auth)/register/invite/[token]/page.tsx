import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Building2, Home, Shield } from "lucide-react";
import { InviteRegisterForm } from "@/components/shared/invite-register-form";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import type { InvitePreview, UserRole } from "@/types";

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

const ROLE_META: Record<
  UserRole,
  { label: string; description: string; icon: typeof Home }
> = {
  ADMIN: {
    label: "Administrador",
    description: "Gestión completa del conjunto",
    icon: Shield,
  },
  RESIDENT: {
    label: "Residente",
    description: "Acceso al panel de tu unidad",
    icon: Home,
  },
  STAFF: {
    label: "Mantenimiento",
    description: "Operación y soporte del conjunto",
    icon: Building2,
  },
  SECURITY: {
    label: "Seguridad",
    description: "Control de acceso y vigilancia",
    icon: Shield,
  },
};

const INVALID_INVITE_MESSAGE =
  "Esta invitación ha expirado o no es válida. Contacta a la administración de tu conjunto.";

function InviteError({ message }: { message?: string }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AlertCircle className="size-6" aria-hidden />
      </div>
      <h2 className="mt-4 font-display text-xl font-semibold text-[var(--foreground)]">
        Invitación no disponible
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
        {message ?? INVALID_INVITE_MESSAGE}
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--brand)] px-5 text-sm font-medium text-white transition-colors hover:bg-[var(--brand)]/90"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default async function InviteRegisterPage({ params }: InvitePageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_invite_by_token", {
    p_token: token,
  });

  const preview = data as InvitePreview | null;

  if (error || !preview?.valid || !preview.complex || !preview.invite) {
    return <InviteError message={INVALID_INVITE_MESSAGE} />;
  }

  const role = preview.invite.role;
  const meta = ROLE_META[role] ?? ROLE_META.RESIDENT;
  const RoleIcon = meta.icon;
  const requireUnit = role === "RESIDENT";
  const logoUrl = preview.complex.logo_url;
  const lockedEmail = preview.invite.email ?? null;

  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex items-start gap-4">
        <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-black/5 bg-[var(--background)]">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`Logo ${preview.complex.name}`}
              width={56}
              height={56}
              className="object-cover"
              unoptimized
            />
          ) : (
            <Building2 className="size-6 text-[var(--brand)]" aria-hidden />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]">
            Invitación a
          </p>
          <h1 className="mt-0.5 truncate font-display text-2xl font-semibold text-[var(--foreground)]">
            {preview.complex.name}
          </h1>
          {(preview.complex.city || preview.complex.address) && (
            <p className="mt-1 truncate text-sm text-[var(--muted)]">
              {[preview.complex.city, preview.complex.address]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="default" className="gap-1">
          <RoleIcon className="size-3" aria-hidden />
          {meta.label}
        </Badge>
        <span className="text-xs text-[var(--muted)]">{meta.description}</span>
      </div>

      <div className="mt-6">
        <InviteRegisterForm
          token={token}
          role={role}
          lockedEmail={lockedEmail}
          requireUnit={requireUnit}
          complexName={preview.complex.name}
        />
      </div>

      <p className="mt-5 text-center text-sm text-[var(--muted)]">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--brand)] hover:underline"
        >
          Inicia sesión
        </Link>{" "}
        y vuelve a abrir este enlace.
      </p>
    </div>
  );
}
