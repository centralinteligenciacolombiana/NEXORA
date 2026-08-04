import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Handshake,
  ImageIcon,
  Lock,
  Moon,
  Sun,
  UserRound,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSignedStorageUrl } from "@/lib/supabase/storage";
import { LogbookForm } from "@/components/security/logbook-form";
import { ShiftClockControls } from "@/components/security/shift-clock-controls";
import { GlassCard } from "@/components/ui/background-panel";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { SecurityPost } from "@/lib/security";
import { SECURITY_POST_LABELS } from "@/lib/security";
import type { ShiftType } from "@/lib/actions/shifts";

type LogRow = {
  id: string;
  title: string;
  description: string;
  evidence_url: string | null;
  created_at: string;
  author_guard_id: string;
  evidence_signed?: string | null;
};

export default async function SecurityLogbookPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, complex_id, security_post")
    .eq("id", user.id)
    .maybeSingle();

  if (
    !profile?.complex_id ||
    (profile.role !== "SECURITY" && profile.role !== "ADMIN")
  ) {
    redirect("/login");
  }

  const { data: complex } = await supabase
    .from("complexes")
    .select("id, name, enable_shift_logbook")
    .eq("id", profile.complex_id)
    .maybeSingle();

  if (!complex) redirect("/login");

  if (!complex.enable_shift_logbook) {
    return (
      <div className="mx-auto max-w-lg space-y-5">
        <Link
          href="/dashboard/security"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a seguridad
        </Link>
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-12 text-center">
          <Lock className="mx-auto size-8 text-[var(--muted)]" aria-hidden />
          <h1 className="mt-3 font-display text-xl font-semibold">
            Bitácora desactivada
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            La administración ha desactivado la bitácora digital de relevos
            para {complex.name}.
          </p>
        </div>
      </div>
    );
  }

  // 7 días: un fin de semana no debe ocultar el último relevo
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: myShift }, { data: logs }] = await Promise.all([
    supabase
      .from("guard_shifts")
      .select("id, shift_type, started_at, post_assignment")
      .eq("guard_id", user.id)
      .eq("status", "ACTIVE")
      .maybeSingle(),
    supabase
      .from("shift_logs")
      .select(
        "id, title, description, evidence_url, created_at, author_guard_id",
      )
      .eq("complex_id", complex.id)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const authorIds = [
    ...new Set((logs ?? []).map((l) => l.author_guard_id).filter(Boolean)),
  ];

  const authorById = new Map<
    string,
    { full_name: string | null; avatar_url: string | null }
  >();

  if (authorIds.length > 0) {
    const { data: authors } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", authorIds);
    for (const a of authors ?? []) {
      authorById.set(a.id, {
        full_name: a.full_name,
        avatar_url: a.avatar_url,
      });
    }
  }

  const logsWithEvidence: LogRow[] = await Promise.all(
    (logs ?? []).map(async (log) => ({
      ...log,
      evidence_signed: await getSignedStorageUrl(
        "shift-evidence",
        log.evidence_url,
      ),
    })),
  );

  // Última novedad de OTRO guardia = lo que debes leer al entrar de relevo
  const previousHandover =
    logsWithEvidence.find((l) => l.author_guard_id !== user.id) ?? null;

  const activeShiftType = (myShift?.shift_type as ShiftType | undefined) ?? null;
  const activePost =
    (myShift?.post_assignment as SecurityPost | null | undefined) ?? null;
  const preferredPost =
    (profile.security_post as SecurityPost | null | undefined) ?? null;

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/security"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver a seguridad
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <BookOpen className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Bitácora de relevos
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Novedades de los últimos 7 días · {complex.name}
          </p>
          {myShift && (
            <div className="mt-2 flex flex-wrap gap-2">
              {myShift.shift_type === "DAY" ? (
                <Badge variant="warning">
                  <Sun className="mr-1 size-3" aria-hidden />
                  Tu turno: Día · desde {formatDateTime(myShift.started_at)}
                </Badge>
              ) : (
                <Badge variant="muted">
                  <Moon className="mr-1 size-3" aria-hidden />
                  Tu turno: Noche · desde {formatDateTime(myShift.started_at)}
                </Badge>
              )}
              {activePost ? (
                <Badge variant="default">
                  {SECURITY_POST_LABELS[activePost]}
                </Badge>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <ShiftClockControls
        activeShiftType={activeShiftType}
        activePost={activePost}
        preferredPost={preferredPost}
        canSelfManage={profile.role === "SECURITY"}
      />

      {previousHandover && (
        <GlassCard
          as="section"
          padding="md"
          className="border-[var(--brand)]/30 bg-[var(--brand-soft)]/40"
        >
          <div className="mb-2 flex items-center gap-2 text-[var(--brand)]">
            <Handshake className="size-4" aria-hidden />
            <h2 className="text-sm font-semibold">Último relevo (leer primero)</h2>
          </div>
          <p className="font-semibold text-[var(--foreground)]">
            {previousHandover.title}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {authorById.get(previousHandover.author_guard_id)?.full_name ||
              "Compañero"}{" "}
            · {formatDateTime(previousHandover.created_at)}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--slate-700)]">
            {previousHandover.description}
          </p>
        </GlassCard>
      )}

      <LogbookForm hasActiveShift={Boolean(myShift)} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--slate-700)]">
          Feed reciente
        </h2>

        {logsWithEvidence.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
            Aún no hay novedades en los últimos 7 días.
          </p>
        ) : (
          <ul className="space-y-3">
            {logsWithEvidence.map((log) => {
              const author = authorById.get(log.author_guard_id);
              return (
                <li key={log.id}>
                  <GlassCard as="article" padding="md">
                    <div className="flex items-start gap-3">
                      {author?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={author.avatar_url}
                          alt=""
                          className="size-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex size-10 items-center justify-center rounded-full bg-[var(--slate-100)] text-[var(--muted)]">
                          <UserRound className="size-4" aria-hidden />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{log.title}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {author?.full_name || "Guardia"} ·{" "}
                          {formatDateTime(log.created_at)}
                          {log.author_guard_id === user.id ? " · Tú" : ""}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--slate-700)]">
                          {log.description}
                        </p>
                        {log.evidence_url && log.evidence_signed && (
                          <a
                            href={log.evidence_signed}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 block overflow-hidden rounded-xl border border-[var(--border)]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={log.evidence_signed}
                              alt="Evidencia"
                              className="max-h-56 w-full object-cover"
                            />
                            <span className="flex items-center gap-1.5 px-3 py-2 text-xs text-[var(--muted)]">
                              <ImageIcon className="size-3.5" aria-hidden />
                              Ver evidencia
                            </span>
                          </a>
                        )}
                        {log.evidence_url && !log.evidence_signed && (
                          <p className="mt-3 text-xs text-[var(--muted)]">
                            Evidencia no disponible
                          </p>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
