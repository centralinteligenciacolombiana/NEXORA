"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Vote } from "lucide-react";
import {
  closePollAction,
  createPollAction,
  type ProjectVotingActionState,
} from "@/lib/actions/projects-voting";
import { isPollOpen, type PollOptionResult } from "@/lib/projects-voting";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime, cn } from "@/lib/utils";

export type AdminPollView = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  options: { id: string; option_text: string }[];
  results: PollOptionResult[];
  totalVotes: number;
};

interface AdminVotingClientProps {
  polls: AdminPollView[];
}

function ResultsBars({
  results,
  totalVotes,
}: {
  results: PollOptionResult[];
  totalVotes: number;
}) {
  return (
    <div className="mt-3 space-y-2.5">
      {results.map((r) => (
        <div key={r.id}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-[var(--foreground)]">
              {r.option_text}
            </span>
            <span className="text-[var(--muted)]">
              {r.votes} · {r.percent}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--slate-100)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all duration-500"
              style={{ width: `${r.percent}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-[var(--muted)]">
        {totalVotes} unidad{totalVotes === 1 ? "" : "es"} participante
        {totalVotes === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export function AdminVotingClient({ polls: initialPolls }: AdminVotingClientProps) {
  const router = useRouter();
  const [polls, setPolls] = useState(initialPolls);
  const [state, formAction, pending] = useActionState(
    createPollAction,
    {} as ProjectVotingActionState,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    setPolls(initialPolls);
  }, [initialPolls]);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  // Resultados en vivo vía Realtime
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-poll-votes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "poll_votes" },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  function onClose(pollId: string) {
    if (!window.confirm("¿Cerrar esta votación ahora?")) return;
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const result = await closePollAction(pollId);
      if (result.error) {
        setErr(result.error);
        return;
      }
      setMsg(result.message ?? "Cerrada.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm sm:p-5"
      >
        <div className="flex items-center gap-2">
          <Vote className="size-4 text-[var(--brand)]" aria-hidden />
          <h2 className="font-semibold">Nueva encuesta express</h2>
        </div>

        <Input
          name="title"
          label="Título"
          required
          placeholder="¿Aprueban el presupuesto 2026?"
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="poll-desc" className="text-sm font-medium">
            Descripción
          </label>
          <textarea
            id="poll-desc"
            name="description"
            rows={2}
            placeholder="Contexto breve para los residentes…"
            className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="poll-options" className="text-sm font-medium">
            Opciones (una por línea)
          </label>
          <textarea
            id="poll-options"
            name="options"
            required
            rows={4}
            defaultValue={"Sí\nNo\nAbstención"}
            className="w-full rounded-lg border border-black/10 px-3 py-2 font-mono text-sm outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20"
          />
        </div>

        <Input
          name="endsAt"
          label="Fecha/hora de cierre (opcional)"
          type="datetime-local"
        />

        {state.error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.success && state.message && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.message}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          {pending ? "Publicando…" : "Publicar votación"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="font-semibold">Encuestas</h2>
        {polls.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-4 py-8 text-center text-sm text-[var(--muted)]">
            No hay votaciones todavía.
          </p>
        ) : (
          <ul className="space-y-4">
            {polls.map((poll) => {
              const open = isPollOpen(poll);
              return (
                <li
                  key={poll.id}
                  className={cn(
                    "rounded-2xl border bg-[var(--surface)] p-4 shadow-sm",
                    open
                      ? "border-[var(--brand)]/30"
                      : "border-[var(--border)]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{poll.title}</p>
                      {poll.description && (
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {poll.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-[var(--slate-500)]">
                        Creada {formatDateTime(poll.created_at)}
                        {poll.ends_at
                          ? ` · Cierra ${formatDateTime(poll.ends_at)}`
                          : ""}
                      </p>
                    </div>
                    <Badge variant={open ? "success" : "muted"}>
                      {open ? "ACTIVA" : "CERRADA"}
                    </Badge>
                  </div>

                  <ResultsBars
                    results={poll.results}
                    totalVotes={poll.totalVotes}
                  />

                  {open && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="mt-3"
                      disabled={busy}
                      onClick={() => onClose(poll.id)}
                    >
                      <Lock className="size-3.5" aria-hidden />
                      Cerrar votación
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>
      )}
      {msg && !err && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {msg}
        </p>
      )}
    </div>
  );
}
