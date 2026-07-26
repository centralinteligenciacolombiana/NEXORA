import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CreateInviteForm } from "@/components/shared/create-invite-form";
import { InviteQrCard } from "@/components/shared/invite-qr-card";
import { InviteRowActions } from "@/components/shared/invite-row-actions";
import { Badge } from "@/components/ui/badge";
import {
  buildInviteUrl,
  formatDateTime,
  inviteStatus,
} from "@/lib/utils";

interface AdminInvitesPageProps {
  searchParams: Promise<{ welcome?: string; token?: string }>;
}

const STATUS_UI = {
  pending: { label: "Pendiente", variant: "warning" as const },
  accepted: { label: "Aceptado", variant: "success" as const },
  expired: { label: "Expirado", variant: "danger" as const },
  inactive: { label: "Inactiva", variant: "muted" as const },
};

const ROLE_LABEL: Record<string, string> = {
  RESIDENT: "Residente",
  SECURITY: "Seguridad",
  STAFF: "Mantenimiento",
  ADMIN: "Admin",
};

export default async function AdminInvitesPage({
  searchParams,
}: AdminInvitesPageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    redirect("/onboarding");
  }

  const { data: complex } = await supabase
    .from("complexes")
    .select("id, name, slug")
    .eq("id", profile.complex_id)
    .single();

  const [{ data: invites }] = await Promise.all([
    supabase
      .from("complex_invites")
      .select(
        "id, token, role, label, uses_count, max_uses, is_active, expires_at, created_at",
      )
      .eq("complex_id", profile.complex_id)
      .order("created_at", { ascending: false }),
  ]);

  const welcomeToken = params.token;
  const welcomeLink = welcomeToken ? buildInviteUrl(welcomeToken) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm text-[var(--muted)]">
            <Mail className="size-3.5" aria-hidden />
            Gestión de invitaciones
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
            Invitaciones
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {complex?.name
              ? `Genera enlaces de ${complex.name} para residentes, seguridad o mantenimiento.`
              : "Genera enlaces de registro por tipo de usuario."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <Link
            href="/dashboard/admin/approvals"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
          >
            Ver registros pendientes
          </Link>
          <Link
            href="/dashboard/admin"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Volver al panel
          </Link>
        </div>
      </div>

      {params.welcome === "1" && welcomeLink && (
        <InviteQrCard
          url={welcomeLink}
          title="¡Conjunto creado! Comparte este QR o enlace"
        />
      )}

      <CreateInviteForm />

      <div className="space-y-3 md:hidden">
        <h2 className="text-sm font-semibold">Invitaciones creadas</h2>
        {(invites ?? []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/10 bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">
            Aún no hay invitaciones. Genera la primera arriba.
          </p>
        ) : (
          (invites ?? []).map((invite) => {
            const status = inviteStatus(invite);
            const ui = STATUS_UI[status];
            const url = buildInviteUrl(invite.token);
            return (
              <article
                key={invite.id}
                className="rounded-xl border border-black/5 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {invite.label ?? ROLE_LABEL[invite.role] ?? invite.role}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {ROLE_LABEL[invite.role] ?? invite.role}
                    </p>
                  </div>
                  <Badge variant={ui.variant}>{ui.label}</Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                  <div>
                    <dt className="font-medium text-[var(--foreground)]">Usos</dt>
                    <dd>
                      {invite.uses_count}
                      {invite.max_uses != null ? ` / ${invite.max_uses}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-[var(--foreground)]">
                      Expira
                    </dt>
                    <dd>
                      {invite.expires_at
                        ? formatDateTime(invite.expires_at)
                        : "Sin fecha"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <InviteRowActions
                    inviteId={invite.id}
                    url={url}
                    label={invite.label ?? invite.role}
                  />
                </div>
              </article>
            );
          })
        )}
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-black/5 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-black/5 bg-[var(--background)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">Invitación</th>
                <th className="px-4 py-3 font-medium">Rol</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Usos</th>
                <th className="px-4 py-3 font-medium">Expira</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {(invites ?? []).length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-[var(--muted)]"
                  >
                    Aún no hay invitaciones. Genera la primera arriba.
                  </td>
                </tr>
              ) : (
                (invites ?? []).map((invite) => {
                  const status = inviteStatus(invite);
                  const ui = STATUS_UI[status];
                  const url = buildInviteUrl(invite.token);
                  return (
                    <tr key={invite.id} className="align-top hover:bg-black/[0.015]">
                      <td className="px-4 py-3 font-medium">
                        {invite.label ??
                          ROLE_LABEL[invite.role] ??
                          invite.role}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {ROLE_LABEL[invite.role] ?? invite.role}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={ui.variant}>{ui.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {invite.uses_count}
                        {invite.max_uses != null
                          ? ` / ${invite.max_uses}`
                          : ""}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)]">
                        {invite.expires_at
                          ? formatDateTime(invite.expires_at)
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <InviteRowActions
                          inviteId={invite.id}
                          url={url}
                          label={invite.label ?? invite.role}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
