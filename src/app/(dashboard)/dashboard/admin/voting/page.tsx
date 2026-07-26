import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Vote } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  AdminVotingClient,
  type AdminPollView,
} from "@/components/admin/admin-voting-client";
import { computePollResults } from "@/lib/projects-voting";

export default async function AdminVotingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, complex_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.complex_id || profile.role !== "ADMIN") {
    redirect("/onboarding");
  }

  const { data: pollRows } = await supabase
    .from("polls")
    .select("id, title, description, status, starts_at, ends_at, created_at")
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
          .select("id, poll_id, option_id")
          .in("poll_id", pollIds)
      : Promise.resolve({ data: [] }),
  ]);

  const polls: AdminPollView[] = (pollRows ?? []).map((poll) => {
    const opts = (options ?? [])
      .filter((o) => o.poll_id === poll.id)
      .map((o) => ({ id: o.id, option_text: o.option_text }));
    const pollVotes = (votes ?? []).filter((v) => v.poll_id === poll.id);
    const { results, totalVotes } = computePollResults(opts, pollVotes);
    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      status: poll.status,
      starts_at: poll.starts_at,
      ends_at: poll.ends_at,
      created_at: poll.created_at,
      options: opts,
      results,
      totalVotes,
    };
  });

  return (
    <div className="mx-auto max-w-lg space-y-5 sm:max-w-2xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--brand)]">
            <Vote className="size-4" aria-hidden />
            Democracia
          </p>
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">
            Votaciones y encuestas
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Resultados en vivo · 1 voto por unidad.
          </p>
        </div>
        <Link
          href="/dashboard/admin"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </Link>
      </div>

      <AdminVotingClient polls={polls} />
    </div>
  );
}
