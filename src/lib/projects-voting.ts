import { formatCurrencyCOP } from "@/lib/community";

export type ProjectStatus = "PROPOSED" | "IN_PROGRESS" | "COMPLETED";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PROPOSED: "Nuevos",
  IN_PROGRESS: "En desarrollo",
  COMPLETED: "Completados",
};

export const PROJECT_STATUS_BADGE: Record<
  ProjectStatus,
  "muted" | "warning" | "success"
> = {
  PROPOSED: "muted",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
};

export type PollStatus = "ACTIVE" | "CLOSED";

export function isPollOpen(poll: {
  status: string;
  ends_at: string | null;
  starts_at?: string | null;
}): boolean {
  if (poll.status !== "ACTIVE") return false;
  const now = Date.now();
  if (poll.starts_at && new Date(poll.starts_at).getTime() > now) return false;
  if (poll.ends_at && new Date(poll.ends_at).getTime() <= now) return false;
  return true;
}

export function formatProjectBudget(
  budget: number | string | null | undefined,
): string | null {
  if (budget == null || budget === "") return null;
  const n = typeof budget === "string" ? Number.parseFloat(budget) : budget;
  if (!Number.isFinite(n)) return null;
  return formatCurrencyCOP(n);
}

export type PollOptionResult = {
  id: string;
  option_text: string;
  votes: number;
  percent: number;
};

export function computePollResults(
  options: { id: string; option_text: string }[],
  votes: { option_id: string }[],
): { results: PollOptionResult[]; totalVotes: number } {
  const totalVotes = votes.length;
  const results = options.map((o) => {
    const count = votes.filter((v) => v.option_id === o.id).length;
    return {
      id: o.id,
      option_text: o.option_text,
      votes: count,
      percent: totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100),
    };
  });
  return { results, totalVotes };
}
