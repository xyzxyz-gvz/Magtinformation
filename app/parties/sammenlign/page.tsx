import Link from "next/link";
import { CaseTypeBadge } from "@/components/CaseTypeBadge";
import { ComparePartyPicker } from "@/components/ComparePartyPicker";
import { EmptyState } from "@/components/EmptyState";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getGovernments,
  getParties,
  getVoteMajorities,
  getVoteTopics,
  getVotesList,
} from "@/lib/data";
import { formatDateRange } from "@/lib/governments";
import type { Party, Vote } from "@/lib/types";

export const metadata = {
  title: "Sammenlign partier — Magtinformation",
};

const TOPIC_MIN_VOTES = 8;

export default async function ComparePartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; gov?: string }>;
}) {
  const sp = await searchParams;
  const a = sp.a ?? "";
  const b = sp.b ?? "";
  const govSlug = sp.gov ?? "";
  const haveBoth = !!a && !!b && a !== b;

  const [parties, governments, votes, majorities, voteTopics] =
    await Promise.all([
      getParties(),
      getGovernments(),
      getVotesList(),
      getVoteMajorities(),
      getVoteTopics(),
    ]);

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const partyA = partyByShort.get(a);
  const partyB = partyByShort.get(b);
  const gov = governments.find((g) => g.slug === govSlug) ?? null;

  return (
    <div className="space-y-10">
      <div>
        <Link href="/parties" className="text-sm text-[var(--color-muted)]">
          ← Partier
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Sammenlign to partier
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          Stil to partier op mod hinanden — hvor enige har deres flertal
          stemt, hvilke emner deler dem, og hvilke afstemninger har de
          stemt forskelligt om?
        </p>
      </div>

      <ComparePartyPicker
        parties={parties}
        initialA={a}
        initialB={b}
        initialGov={govSlug}
        governments={governments}
      />

      {!haveBoth ? (
        <EmptyState
          title="Vælg to partier at sammenligne"
          body="Brug felterne ovenfor — du kan også begrænse sammenligningen til en bestemt regeringsperiode."
        />
      ) : !partyA || !partyB ? (
        <EmptyState title="Et af partierne kunne ikke findes" />
      ) : (
        <Comparison
          a={partyA}
          b={partyB}
          gov={gov}
          votes={votes}
          majorities={majorities}
          voteTopics={voteTopics}
        />
      )}
    </div>
  );
}

function Comparison({
  a,
  b,
  gov,
  votes,
  majorities,
  voteTopics,
}: {
  a: Party;
  b: Party;
  gov: { slug: string; name: string; start: string; end: string | null } | null;
  votes: Vote[];
  majorities: Record<string, Record<string, number>>;
  voteTopics: Record<string, string[]>;
}) {
  // Scope votes to selected period if any
  const scoped = gov
    ? votes.filter(
        (v) =>
          v.dato >= gov.start && (gov.end === null || v.dato < gov.end),
      )
    : votes;

  // Walk votes once, computing both per-topic agreement and a list of disagreements
  type Counters = { same: number; diff: number; total: number };
  const overall: Counters = { same: 0, diff: 0, total: 0 };
  const topicAgree = new Map<string, Counters>();
  const disagreements: {
    id: number;
    d: string;
    ct: string | null;
    cn: string | null;
    sa: 1 | 2 | 4;
    sb: 1 | 2 | 4;
    v: boolean;
  }[] = [];

  for (const v of scoped) {
    const m = majorities[String(v.id)];
    if (!m) continue;
    const sa = m[a.short];
    const sb = m[b.short];
    if ((sa !== 1 && sa !== 2 && sa !== 4) || (sb !== 1 && sb !== 2 && sb !== 4))
      continue;
    overall.total++;
    const same = sa === sb;
    if (same) overall.same++;
    else overall.diff++;

    const ts = voteTopics[String(v.id)];
    if (ts) {
      for (const t of ts) {
        const c = topicAgree.get(t) ?? { same: 0, diff: 0, total: 0 };
        c.total++;
        if (same) c.same++;
        else c.diff++;
        topicAgree.set(t, c);
      }
    }

    if (!same) {
      disagreements.push({
        id: v.id,
        d: v.dato,
        ct: v.caseTitel,
        cn: v.caseNummer,
        sa: sa as 1 | 2 | 4,
        sb: sb as 1 | 2 | 4,
        v: !!v.vedtaget,
      });
    }
  }

  disagreements.sort((x, y) => y.d.localeCompare(x.d));

  const agreementPct = overall.total
    ? Math.round((overall.same / overall.total) * 100)
    : null;
  const disagreementPct = overall.total
    ? 100 - (agreementPct ?? 0)
    : null;

  // Topic rankings
  const topicRows = [...topicAgree.entries()]
    .filter(([, c]) => c.total >= TOPIC_MIN_VOTES)
    .map(([topic, c]) => ({
      topic,
      same: c.same,
      diff: c.diff,
      total: c.total,
      agreePct: c.total ? c.same / c.total : 0,
    }));
  const mostAgreeTopics = [...topicRows]
    .sort((x, y) => y.agreePct - x.agreePct)
    .slice(0, 6);
  const mostDisagreeTopics = [...topicRows]
    .sort((x, y) => x.agreePct - y.agreePct)
    .slice(0, 6);

  return (
    <div className="space-y-10">
      <div className="grid gap-4 md:grid-cols-2">
        <PartyCard party={a} />
        <PartyCard party={b} />
      </div>

      <section className="rounded-xl border border-[var(--color-line)] p-6">
        <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
          Enighed
          {gov && ` · ${gov.name}`}
        </div>
        {agreementPct == null ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Ingen fælles afstemninger i denne periode hvor begge havde et flertal.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <div className="text-5xl font-semibold tabular-nums">
                {agreementPct}%
              </div>
              <div className="text-sm text-[var(--color-muted)]">
                stemte ens i {overall.same.toLocaleString("da-DK")} af{" "}
                {overall.total.toLocaleString("da-DK")} fælles afstemninger
              </div>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full">
              <div
                style={{
                  width: `${agreementPct}%`,
                  background: "#16a34a",
                }}
              />
              <div
                style={{
                  width: `${disagreementPct}%`,
                  background: "#dc2626",
                }}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-[var(--color-muted)]">
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-600 align-middle" />
                Enige · {overall.same.toLocaleString("da-DK")}
              </span>
              <span>
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-rose-600 align-middle" />
                Uenige · {overall.diff.toLocaleString("da-DK")}
              </span>
            </div>
          </>
        )}
      </section>

      {topicRows.length > 0 && (
        <section className="grid gap-6 md:grid-cols-2">
          <TopicAgreement
            title="Mest enige om"
            rows={mostAgreeTopics}
            kind="agree"
          />
          <TopicAgreement
            title="Mest uenige om"
            rows={mostDisagreeTopics}
            kind="disagree"
          />
        </section>
      )}

      {disagreements.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Stemte forskelligt
          </h2>
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {disagreements.slice(0, 50).map((d) => (
              <li key={d.id}>
                <Link
                  href={`/votes/${d.id}`}
                  className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 py-3 hover:bg-[var(--color-soft)]"
                >
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <CaseTypeBadge
                        caseNummer={d.cn}
                        caseTitel={d.ct}
                      />
                      <span className="truncate text-sm">
                        {d.ct ?? `Afstemning #${d.id}`}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                      <span className={d.v ? "text-emerald-700" : "text-rose-700"}>
                        {d.v ? "Vedtaget" : "Forkastet"}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs tabular-nums">
                    <span className="text-[var(--color-muted)]">{a.short}: </span>
                    <Stance s={d.sa} />
                    <span className="mx-1 text-[var(--color-muted)]">·</span>
                    <span className="text-[var(--color-muted)]">{b.short}: </span>
                    <Stance s={d.sb} />
                  </div>
                  <div className="text-xs tabular-nums text-[var(--color-muted)]">
                    {d.d}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {disagreements.length > 50 && (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Viser de seneste 50 af{" "}
              {disagreements.length.toLocaleString("da-DK")} uenigheder.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function PartyCard({ party }: { party: Party }) {
  return (
    <Link
      href={`/parties/${party.short}`}
      className="flex items-center gap-4 rounded-xl border-2 p-4 no-underline hover:bg-[var(--color-soft)] hover:no-underline"
      style={{ borderColor: party.color }}
    >
      <PartyBadge party={party} size="lg" />
      <div className="min-w-0">
        <div className="text-base font-semibold">{party.navn}</div>
        <div className="text-xs text-[var(--color-muted)]">
          Bogstav {party.letter} · klik for fuld profil
        </div>
      </div>
    </Link>
  );
}

function Stance({ s }: { s: 1 | 2 | 4 }) {
  if (s === 1) return <span className="font-medium text-emerald-700">for</span>;
  if (s === 2) return <span className="font-medium text-rose-700">imod</span>;
  return <span className="font-medium text-amber-700">hverken</span>;
}

function TopicAgreement({
  title,
  rows,
  kind,
}: {
  title: string;
  rows: { topic: string; same: number; diff: number; total: number; agreePct: number }[];
  kind: "agree" | "disagree";
}) {
  return (
    <div>
      <h3
        className={`mb-2 text-xs font-medium uppercase tracking-wider ${
          kind === "agree" ? "text-emerald-700" : "text-rose-700"
        }`}
      >
        {title}
      </h3>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const ap = Math.round(r.agreePct * 100);
          return (
            <li key={r.topic}>
              <Link
                href={`/topics/${encodeURIComponent(r.topic)}`}
                className="block rounded px-2 py-1.5 hover:bg-[var(--color-soft)]"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate">{r.topic}</span>
                  <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                    {ap}% ens · {r.total}
                  </span>
                </div>
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full">
                  <div
                    style={{ width: `${ap}%`, background: "#16a34a" }}
                  />
                  <div
                    style={{ width: `${100 - ap}%`, background: "#dc2626" }}
                  />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
