"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Vote } from "lucide-react";
import {
  castVoteAction,
  type ProjectVotingActionState,
} from "@/lib/actions/projects-voting";
import {
  isPollOpen,
  type PollOptionResult,
} from "@/lib/projects-voting";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime, cn } from "@/lib/utils";

export type ResidentPollCard = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  starts_at: string;
  ends_at: string | null;
  options: { id: string; option_text: string }[];
  results: PollOptionResult[];
  totalVotes: number;
  hasVoted: boolean;
  myOptionId: string | null;
};

interface ResidentVotingClientProps {
  polls: ResidentPollCard[];
  hasUnit: boolean;
}

function ResultsBars({
  results,
  totalVotes,
  highlightOptionId,
}: {
  results: PollOptionResult[];
  totalVotes: number;
  highlightOptionId?: string | null;
}) {
  return (
    <div className="space-y-2.5">
      {results.map((r) => (
        <div key={r.id}>
          <div className="mb-1 flex items-center justify-between gap-2 text-xs">
            <span
              className={cn(
                "font-medium",
                r.id === highlightOptionId && "text-[var(--brand)]",
              )}
            >
              {r.option_text}
              {r.id === highlightOptionId ? " (tu voto)" : ""}
            </span>
            <span className="text-[var(--muted)]">
              {r.votes} · {r.percent}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--slate-100)]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                r.id === highlightOptionId
                  ? "bg-[var(--brand)]"
                  : "bg-[var(--slate-400)]",
              )}
              style={{ width: `${r.percent}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-[var(--muted)]">
        {totalVotes} unidad{totalVotes === 1 ? "" : "es"} ha
        {totalVotes === 1 ? "" : "n"} votado
      </p>
    </div>
  );
}

function VoteForm({ poll }: { poll: ResidentPollCard }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("");
  const [state, formAction, pending] = useActionState(
    castVoteAction,
    {} as ProjectVotingActionState,
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <input type="hidden" name="pollId" value={poll.id} />
      <fieldset className="space-y-2">
        <legend className="sr-only">Opciones</legend>
        {poll.options.map((o) => (
          <label
            key={o.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm transition-colors",
              selected === o.id
                ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                : "border-[var(--border)] bg-white hover:border-[var(--brand)]/30",
            )}
          >
            <input
              type="radio"
              name="optionId"
              value={o.id}
              required
              checked={selected === o.id}
              onChange={() => setSelected(o.id)}
              className="size-4 accent-[var(--brand)]"
            />
            {o.option_text}
          </label>
        ))}
      </fieldset>

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

      <Button
        type="submit"
        size="lg"
        className="min-h-12 w-full"
        disabled={pending || !selected}
      >
        {pending ? "Enviando…" : "Emitir voto"}
      </Button>
    </form>
  );
}

export function ResidentVotingClient({
  polls,
  hasUnit,
}: ResidentVotingClientProps) {
  const active = polls.filter((p) => isPollOpen(p));
  const closed = polls.filter((p) => !isPollOpen(p));

  if (!hasUnit) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-10 text-center text-sm text-[var(--muted)]">
        Necesitas una unidad asignada para participar en las votaciones.
      </p>
    );
  }

  if (polls.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-white px-4 py-12 text-center">
        <Vote className="mx-auto size-8 text-[var(--muted)]" aria-hidden />
        <p className="mt-3 text-sm text-[var(--muted)]">
          No hay encuestas publicadas por ahora.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--slate-700)]">
            Votaciones activas
          </h2>
          <ul className="space-y-4">
            {active.map((poll) => (
              <li
                key={poll.id}
                className="rounded-2xl border border-[var(--brand)]/25 bg-white p-4 shadow-sm ring-1 ring-[var(--brand)]/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{poll.title}</p>
                    {poll.description && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {poll.description}
                      </p>
                    )}
                    {poll.ends_at && (
                      <p className="mt-1 text-xs text-[var(--slate-500)]">
                        Cierra {formatDateTime(poll.ends_at)}
                      </p>
                    )}
                  </div>
                  <Badge variant="success">ACTIVA</Badge>
                </div>

                {poll.hasVoted ? (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-medium text-emerald-800">
                      Ya votaste con tu unidad. Resultados parciales:
                    </p>
                    <ResultsBars
                      results={poll.results}
                      totalVotes={poll.totalVotes}
                      highlightOptionId={poll.myOptionId}
                    />
                  </div>
                ) : (
                  <VoteForm poll={poll} />
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--slate-700)]">
            Cerradas / resultados
          </h2>
          <ul className="space-y-4">
            {closed.map((poll) => (
              <li
                key={poll.id}
                className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{poll.title}</p>
                    {poll.description && (
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        {poll.description}
                      </p>
                    )}
                  </div>
                  <Badge variant="muted">CERRADA</Badge>
                </div>
                <div className="mt-4">
                  <ResultsBars
                    results={poll.results}
                    totalVotes={poll.totalVotes}
                    highlightOptionId={poll.myOptionId}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
