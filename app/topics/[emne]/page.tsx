import Link from "next/link";
import { notFound } from "next/navigation";
import { CaseTypeBadge } from "@/components/CaseTypeBadge";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getParties,
  getVoteMajorities,
  getVoteTopics,
  getVotesList,
} from "@/lib/data";
import type { Vote } from "@/lib/types";

export default async function TopicDetail({
  params,
  searchParams,
}: {
  params: Promise<{ emne: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { emne: emneEnc } = await params;
  const { page: pageStr } = await searchParams;
  const emne = decodeURIComponent(emneEnc);
  const page = Math.max(1, Number(pageStr ?? "1") || 1);

  const [voteTopics, votes, parties, majorities] = await Promise.all([
    getVoteTopics(),
    getVotesList(),
    getParties(),
    getVoteMajorities(),
  ]);

  const voteIdsForTopic = new Set<number>();
  for (const [vidStr, ts] of Object.entries(voteTopics)) {
    if (ts.includes(emne)) voteIdsForTopic.add(Number(vidStr));
  }
  if (voteIdsForTopic.size === 0) notFound();

  const filtered = votes
    .filter((v) => voteIdsForTopic.has(v.id))
    .sort((a, b) => b.dato.localeCompare(a.dato));

  // Party stance summary across all votes on this topic
  const stanceByParty = new Map<
    string,
    { for: number; imod: number; hverken: number; total: number }
  >();
  for (const v of filtered) {
    const m = majorities[String(v.id)];
    if (!m) continue;
    for (const [partyShort, t] of Object.entries(m)) {
      const row = stanceByParty.get(partyShort) ?? {
        for: 0,
        imod: 0,
        hverken: 0,
        total: 0,
      };
      row.total++;
      if (t === 1) row.for++;
      else if (t === 2) row.imod++;
      else if (t === 4) row.hverken++;
      stanceByParty.set(partyShort, row);
    }
  }

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const stanceRows = [...stanceByParty.entries()]
    .map(([short, c]) => ({
      short,
      party: partyByShort.get(short),
      ...c,
      forPct: c.total ? Math.round((c.for / c.total) * 100) : 0,
      imodPct: c.total ? Math.round((c.imod / c.total) * 100) : 0,
      hverkenPct: c.total ? Math.round((c.hverken / c.total) * 100) : 0,
    }))
    .filter((r) => r.party && r.total >= 5)
    .sort(
      (a, b) =>
        (a.party?.left_order ?? 99) - (b.party?.left_order ?? 99) ||
        b.total - a.total,
    );

  const PAGE_SIZE = 50;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const passed = filtered.filter((v) => v.vedtaget).length;
  const passRate = filtered.length
    ? Math.round((passed / filtered.length) * 100)
    : 0;

  return (
    <div className="space-y-10">
      <div>
        <Link href="/topics" className="text-sm text-[var(--color-muted)]">
          ← Emner
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{emne}</h1>
        <div className="mt-2 text-sm text-[var(--color-muted)]">
          {filtered.length.toLocaleString("da-DK")} afstemninger ·{" "}
          {passed.toLocaleString("da-DK")} vedtaget ({passRate}%)
        </div>
        <Link
          href={`/votes?topic=${encodeURIComponent(emne)}`}
          className="mt-2 inline-block text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
        >
          Filtrer alle afstemninger på dette emne →
        </Link>
      </div>

      {stanceRows.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Partiernes flertal på {emne}
          </h2>
          <p className="mb-3 text-xs text-[var(--color-muted)]">
            Hver bjælke viser hvordan partiets flertal stemte hen over alle
            afstemninger på dette emne. Partier med under 5 afstemninger
            udeladt. Sorteret venstrefløj → højrefløj.
          </p>
          <ul className="space-y-2.5">
            {stanceRows.map((r) => (
              <li
                key={r.short}
                className="rounded-lg border border-[var(--color-line)] bg-white px-4 py-3 transition hover:border-[var(--color-ink)]/30"
              >
                <Link
                  href={`/parties/${r.short}`}
                  className="block no-underline hover:no-underline"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <PartyBadge party={r.party} size="sm" />
                      <span className="font-medium text-[var(--color-ink)]">
                        {r.party?.navn ?? r.short}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-3 text-xs tabular-nums">
                      <span className="text-emerald-700">
                        For {r.forPct}%
                      </span>
                      <span className="text-rose-700">
                        Imod {r.imodPct}%
                      </span>
                      {r.hverken > 0 && (
                        <span className="text-amber-700">
                          Hverken {r.hverkenPct}%
                        </span>
                      )}
                      <span className="text-[var(--color-muted)]">
                        · {r.total} afstemninger
                      </span>
                    </div>
                  </div>
                  <Stance
                    forPct={r.forPct}
                    imodPct={r.imodPct}
                    hverkenPct={r.hverkenPct}
                    forCount={r.for}
                    imodCount={r.imod}
                    hverkenCount={r.hverken}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Afstemninger
        </h2>
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {slice.map((v) => (
            <VoteRow key={v.id} v={v} />
          ))}
        </ul>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link
              aria-disabled={safePage <= 1}
              className={
                safePage <= 1
                  ? "pointer-events-none text-[var(--color-muted)]"
                  : ""
              }
              href={`/topics/${emneEnc}?page=${safePage - 1}`}
            >
              ← Forrige
            </Link>
            <span className="text-[var(--color-muted)]">
              Side {safePage} af {totalPages.toLocaleString("da-DK")}
            </span>
            <Link
              aria-disabled={safePage >= totalPages}
              className={
                safePage >= totalPages
                  ? "pointer-events-none text-[var(--color-muted)]"
                  : ""
              }
              href={`/topics/${emneEnc}?page=${safePage + 1}`}
            >
              Næste →
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function Stance({
  forPct,
  imodPct,
  hverkenPct,
}: {
  forPct: number;
  imodPct: number;
  hverkenPct: number;
  // legacy fields kept for backwards-compatibility with other callers
  forCount?: number;
  imodCount?: number;
  hverkenCount?: number;
}) {
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full">
      <div style={{ width: `${forPct}%`, background: "#16a34a" }} />
      <div style={{ width: `${imodPct}%`, background: "#dc2626" }} />
      <div style={{ width: `${hverkenPct}%`, background: "#eab308" }} />
    </div>
  );
}

function VoteRow({ v }: { v: Vote }) {
  return (
    <li>
      <Link
        href={`/votes/${v.id}`}
        className="flex items-baseline justify-between gap-6 py-2 hover:bg-[var(--color-soft)]"
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
            <span className={v.vedtaget ? "text-emerald-700" : "text-rose-700"}>
              {v.vedtaget ? "Vedtaget" : "Forkastet"}
            </span>{" "}
            · {v.forCount} for / {v.imodCount} imod
          </div>
        </div>
        <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
          {v.dato}
        </div>
      </Link>
    </li>
  );
}
