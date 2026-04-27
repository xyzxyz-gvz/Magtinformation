import Link from "next/link";
import { CaseTypeBadge, classifyCase } from "@/components/CaseTypeBadge";
import { VotesPerMonthChart } from "@/components/charts/VotesPerMonthChart";
import { EmptyState } from "@/components/EmptyState";
import { VoteBar } from "@/components/VoteBar";
import { VotesFilter } from "@/components/VotesFilter";
import { getGovernments, getVotesList } from "@/lib/data";
import { getGovernmentForDate } from "@/lib/governments";

const PAGE_SIZE = 50;

export default async function VotesIndex({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    gov?: string;
    outcome?: string;
    topic?: string;
    kind?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const govSlug = sp.gov ?? "";
  const outcome = sp.outcome ?? "";
  const topic = sp.topic ?? "";
  const kind = sp.kind ?? "";
  const q = (sp.q ?? "").trim();

  const [governments, votes] = await Promise.all([
    getGovernments(),
    getVotesList(),
  ]);
  const gov = governments.find((g) => g.slug === govSlug) ?? null;

  const topicCounts = new Map<string, number>();
  for (const v of votes) {
    for (const t of v.topics ?? []) {
      topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
    }
  }
  const topics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100)
    .map(([t]) => t)
    .sort((a, b) => a.localeCompare(b, "da"));

  let filtered = votes;
  if (gov) {
    filtered = filtered.filter(
      (v) => v.dato >= gov.start && (gov.end === null || v.dato < gov.end),
    );
  }
  if (outcome === "passed") filtered = filtered.filter((v) => v.vedtaget);
  if (outcome === "rejected") filtered = filtered.filter((v) => !v.vedtaget);
  if (topic) filtered = filtered.filter((v) => (v.topics ?? []).includes(topic));
  if (kind) {
    filtered = filtered.filter((v) => {
      const k = classifyCase(v.caseNummer, v.caseTitel);
      if (kind === "L") return k === "Lovforslag";
      if (kind === "B") return k === "Beslutningsforslag";
      if (kind === "V") return k === "Forslag til vedtagelse";
      if (kind === "Borger") return k === "Borgerforslag";
      return true;
    });
  }
  if (q) {
    const needle = q.toLowerCase();
    filtered = filtered.filter((v) => {
      const title = (v.caseTitel ?? "").toLowerCase();
      const concl = (v.konklusion ?? "").toLowerCase();
      return title.includes(needle) || concl.includes(needle);
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const slice = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const qs = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (govSlug) params.set("gov", govSlug);
    if (outcome) params.set("outcome", outcome);
    if (topic) params.set("topic", topic);
    if (kind) params.set("kind", kind);
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  // Activity sparkline — votes per month from the *currently filtered* set
  // (so it adapts to whatever the user has filtered down to).
  const monthCounts = new Map<string, number>();
  for (const v of filtered) {
    const m = v.dato.slice(0, 7); // YYYY-MM
    monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1);
  }
  const months = [...monthCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Afstemninger</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {total.toLocaleString("da-DK")} afstemninger
        </p>
      </div>

      {months.length > 1 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3 text-xs text-[var(--color-muted)]">
            <span className="uppercase tracking-wider">
              Afstemninger pr. måned
            </span>
            <span className="tabular-nums">
              {months.length} måneder · gennemsnit{" "}
              {Math.round(total / months.length).toLocaleString("da-DK")}/md
            </span>
          </div>
          <VotesPerMonthChart data={months} />
        </section>
      )}

      <VotesFilter
        governments={governments}
        topics={topics}
        govSlug={govSlug}
        outcome={outcome}
        topic={topic}
        kind={kind}
        q={q}
      />

      {slice.length === 0 ? (
        <EmptyState
          title="Ingen afstemninger matcher filtrene"
          body="Prøv at vælge en anden regering, et andet emne eller en anden søgetekst."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {slice.map((v) => {
            const govForVote = getGovernmentForDate(governments, v.dato);
            return (
              <li key={v.id}>
                <Link
                  href={`/votes/${v.id}`}
                  className="flex items-center gap-4 py-3 hover:bg-[var(--color-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <CaseTypeBadge
                        caseNummer={v.caseNummer}
                        caseTitel={v.caseTitel}
                      />
                      <span className="truncate text-sm">
                        {v.caseTitel ?? v.konklusion ?? `Afstemning #${v.id}`}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {govForVote?.name ?? "—"} ·{" "}
                      <span
                        className={
                          v.vedtaget ? "text-emerald-700" : "text-rose-700"
                        }
                      >
                        {v.vedtaget ? "Vedtaget" : "Forkastet"}
                      </span>
                      {v.type && v.type !== "Endelig vedtagelse" && (
                        <>
                          {" · "}
                          <span>{v.type.toLowerCase()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="hidden shrink-0 sm:block">
                    <VoteBar
                      forCount={v.forCount}
                      imodCount={v.imodCount}
                      hverkenCount={v.hverkenCount}
                      fraværCount={v.fraværCount}
                    />
                  </div>
                  <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                    {v.dato}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between text-sm">
        <Link
          aria-disabled={page <= 1}
          className={
            page <= 1
              ? "pointer-events-none text-[var(--color-muted)]"
              : "text-[var(--color-ink)]"
          }
          href={`/votes${qs({ page: String(page - 1) })}`}
        >
          ← Forrige
        </Link>
        <div className="text-[var(--color-muted)]">
          Side {page} af {totalPages.toLocaleString("da-DK")}
        </div>
        <Link
          aria-disabled={page >= totalPages}
          className={
            page >= totalPages
              ? "pointer-events-none text-[var(--color-muted)]"
              : "text-[var(--color-ink)]"
          }
          href={`/votes${qs({ page: String(page + 1) })}`}
        >
          Næste →
        </Link>
      </div>
    </div>
  );
}
