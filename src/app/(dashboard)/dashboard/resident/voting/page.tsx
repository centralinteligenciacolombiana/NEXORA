import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  ResidentVotingClient,
  type ResidentPollCard,
} from "@/components/resident/resident-voting-client";
import { computePollResults } from "@/lib/projects-voting";

export default async function ResidentVotingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id, unit_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "RESIDENT") {
    redirect("/login");
  }

  const { data: pollRows } = await supabase
    .from("polls")
    .select("id, title, description, status, starts_at, ends_at")
    .eq("complex_id", profile.complex_id)
    .order("created_at", { ascending: false });

  const pollIds = (pollRows ?? []).map((p) => p.id);

  const [{ data: options }, { data: votes }] = await Promise.all([
    pollIds.length > 0
      ? supabase
          .from("poll_options")
          .select("id, poll_id, option_text, sort_order")
          .in("poll_id", pollIds)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    pollIds.length > 0
      ? supabase
          .from("poll_votes")
          .select("id, poll_id, option_id, unit_id")
          .in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
  ]);

  const polls: ResidentPollCard[] = (pollRows ?? []).map((poll) => {
    const opts = (options ?? [])
      .filter((o) => o.poll_id === poll.id)
      .map((o) => ({ id: o.id, option_text: o.option_text }));
    const pollVotes = (votes ?? []).filter((v) => v.poll_id === poll.id);
    const { results, totalVotes } = computePollResults(opts, pollVotes);
    const myVote = profile.unit_id
      ? pollVotes.find((v) => v.unit_id === profile.unit_id)
      : undefined;

    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      status: poll.status,
      starts_at: poll.starts_at,
      ends_at: poll.ends_at,
      options: opts,
      results,
      totalVotes,
      hasVoted: Boolean(myVote),
      myOptionId: myVote?.option_id ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <Link
        href="/dashboard/resident"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al inicio
      </Link>

      <div className="flex items-start gap-3">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Vote className="size-5" aria-hidden />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Democracia y votaciones
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Un voto por apartamento. Resultados transparentes.
          </p>
        </div>
      </div>

      <ResidentVotingClient
        polls={polls}
        hasUnit={Boolean(profile.unit_id)}
      />
    </div>
  );
}
