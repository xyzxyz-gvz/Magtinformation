import Link from "next/link";
import { notFound } from "next/navigation";
import { DemographicStats } from "@/components/DemographicStats";
import { PartyBadge } from "@/components/PartyBadge";
import {
  PartyVotesExplorer,
  type PartyVoteRow,
} from "@/components/PartyVotesExplorer";
import {
  getGovernments,
  getMembers,
  getParties,
  getPartyAgreement,
  getVoteMajorities,
  getVoteTopics,
  getVotesList,
} from "@/lib/data";
import { formatDateRange } from "@/lib/governments";
import type { Government, Member } from "@/lib/types";

export async function generateStaticParams() {
  const parties = await getParties();
  return parties.map((p) => ({ short: p.short }));
}

const FAR_FUTURE = "9999-99-99";

function membersDuring(
  members: Member[],
  partyShort: string,
  gov: Government | null,
): Member[] {
  return members.filter((m) => {
    if (m.partyShort !== partyShort) return false;
    if (!m.firstVoteDate || !m.lastVoteDate) return false;
    if (!gov) return m.isCurrentMF;
    const govEnd = gov.end ?? FAR_FUTURE;
    return m.firstVoteDate <= govEnd && m.lastVoteDate >= gov.start;
  });
}

export default async function PartyDetail({
  params,
}: {
  params: Promise<{ short: string }>;
}) {
  const { short } = await params;
  const [parties, members, governments, votes, majorities, agreement, voteTopics] =
    await Promise.all([
      getParties(),
      getMembers(),
      getGovernments(),
      getVotesList(),
      getVoteMajorities(),
      getPartyAgreement(),
      getVoteTopics(),
    ]);

  const party = parties.find((p) => p.short === short);
  if (!party) notFound();
  const partyByShort = new Map(parties.map((p) => [p.short, p]));

  const currentMembers = membersDuring(members, short, null);
  const partyMembers = members.filter((m) => m.partyShort === short);
  const totalEver = partyMembers.length;

  const partyVoteCounts = { for: 0, imod: 0, hverken: 0, total: 0 };
  for (const v of votes) {
    const m = majorities[String(v.id)];
    const t = m?.[short];
    if (!t) continue;
    partyVoteCounts.total++;
    if (t === 1) partyVoteCounts.for++;
    else if (t === 2) partyVoteCounts.imod++;
    else if (t === 4) partyVoteCounts.hverken++;
  }

  const cohesionDenominator =
    partyVoteCounts.for + partyVoteCounts.imod + partyVoteCounts.hverken;
  const cohesionPct = partyVoteCounts.total
    ? Math.round((cohesionDenominator / partyVoteCounts.total) * 100)
    : null;

  // Closest / most-distant parties from the agreement matrix
  type Allyrow = {
    short: string;
    agreement: number;
    shared: number;
  };
  let closest: Allyrow[] = [];
  let furthest: Allyrow[] = [];
  if (agreement) {
    const i = agreement.parties.indexOf(short);
    if (i >= 0) {
      const rows: Allyrow[] = agreement.parties
        .map((p, j) => ({
          short: p,
          agreement: agreement.matrix[i][j] ?? 0,
          shared: agreement.shared[i][j] ?? 0,
        }))
        .filter((r) => r.short !== short && r.shared >= 200);
      closest = [...rows].sort((a, b) => b.agreement - a.agreement).slice(0, 5);
      furthest = [...rows].sort((a, b) => a.agreement - b.agreement).slice(0, 5);
    }
  }

  // Per-topic stance: how often did this party's flertal stemme for/imod/hverken
  // when an emneord var knyttet til afstemningen.
  const TOPIC_MIN_VOTES = 5;
  type TopicStance = {
    topic: string;
    for: number;
    imod: number;
    hverken: number;
    total: number;
  };
  const topicStanceMap = new Map<string, TopicStance>();
  for (const v of votes) {
    const partyMaj = majorities[String(v.id)]?.[short];
    if (!partyMaj) continue;
    const ts = voteTopics[String(v.id)];
    if (!ts || ts.length === 0) continue;
    for (const t of ts) {
      const row = topicStanceMap.get(t) ?? {
        topic: t,
        for: 0,
        imod: 0,
        hverken: 0,
        total: 0,
      };
      if (partyMaj === 1) row.for++;
      else if (partyMaj === 2) row.imod++;
      else if (partyMaj === 4) row.hverken++;
      row.total++;
      topicStanceMap.set(t, row);
    }
  }
  const topicStanceAll = [...topicStanceMap.values()].filter(
    (r) => r.total >= TOPIC_MIN_VOTES,
  );
  const topicByVolume = [...topicStanceAll]
    .sort((a, b) => b.total - a.total)
    .slice(0, 12);
  const topicMostFor = [...topicStanceAll]
    .filter((r) => r.total >= 10)
    .sort((a, b) => b.for / b.total - a.for / a.total)
    .slice(0, 5);
  const topicMostImod = [...topicStanceAll]
    .filter((r) => r.total >= 10)
    .sort((a, b) => b.imod / b.total - a.imod / a.total)
    .slice(0, 5);

  // Build per-vote rows annotated with party stance for the PartyVotesExplorer.
  // Sorted newest first so the default "Alle" tab shows recent activity.
  const partyVoteRows: PartyVoteRow[] = [];
  for (const v of votes) {
    const stance = majorities[String(v.id)]?.[short];
    if (stance !== 1 && stance !== 2 && stance !== 4) continue;
    partyVoteRows.push({
      id: v.id,
      d: v.dato,
      v: !!v.vedtaget,
      ct: v.caseTitel,
      cn: v.caseNummer,
      s: stance,
    });
  }
  partyVoteRows.sort((a, b) => b.d.localeCompare(a.d));

  return (
    <div className="space-y-10">
      <div>
        <Link href="/parties" className="text-sm text-[var(--color-muted)]">
          ← Partier
        </Link>
      </div>

      <header className="flex items-center gap-4">
        <PartyBadge party={party} size="lg" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {party.navn}
          </h1>
          <div className="mt-1 text-sm text-[var(--color-muted)]">
            Bogstav {party.letter} ·{" "}
            <span
              className="inline-block h-2.5 w-2.5 rounded-full align-middle"
              style={{ background: party.color }}
            />{" "}
            <span className="font-mono text-xs">{party.color}</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Nuværende MF'er" value={String(currentMembers.length)} />
        <Stat label="Medlemmer i alt" value={String(totalEver)} />
        <Stat
          label="Partienhed"
          value={cohesionPct != null ? `${cohesionPct}%` : "—"}
          hint={
            cohesionPct != null
              ? `flertal valgt i ${partyVoteCounts.total.toLocaleString("da-DK")} afstemninger`
              : undefined
          }
        />
      </div>

      {currentMembers.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Demografi · nuværende MF'er
          </h2>
          <DemographicStats
            members={currentMembers}
            refDate={new Date().toISOString().slice(0, 10)}
            showParty={false}
          />
        </section>
      )}

      {(closest.length > 0 || furthest.length > 0) && (
        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Stemmer mest med
            </h2>
            <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {closest.map((r) => {
                const p = partyByShort.get(r.short);
                return (
                  <li key={r.short}>
                    <Link
                      href={`/parties/${r.short}`}
                      className="flex items-center justify-between gap-3 py-2 hover:bg-[var(--color-soft)]"
                    >
                      <div className="flex items-center gap-2">
                        <PartyBadge party={p} size="sm" />
                        <span className="text-sm">{p?.navn ?? r.short}</span>
                      </div>
                      <div className="text-sm tabular-nums">
                        {(r.agreement * 100).toFixed(1)}%
                        <span className="ml-1 text-xs text-[var(--color-muted)]">
                          / {r.shared.toLocaleString("da-DK")}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Stemmer mindst med
            </h2>
            <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {furthest.map((r) => {
                const p = partyByShort.get(r.short);
                return (
                  <li key={r.short}>
                    <Link
                      href={`/parties/${r.short}`}
                      className="flex items-center justify-between gap-3 py-2 hover:bg-[var(--color-soft)]"
                    >
                      <div className="flex items-center gap-2">
                        <PartyBadge party={p} size="sm" />
                        <span className="text-sm">{p?.navn ?? r.short}</span>
                      </div>
                      <div className="text-sm tabular-nums">
                        {(r.agreement * 100).toFixed(1)}%
                        <span className="ml-1 text-xs text-[var(--color-muted)]">
                          / {r.shared.toLocaleString("da-DK")}
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Stemmemønster
        </h2>
        {partyVoteCounts.total === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Ingen data.</p>
        ) : (
          <VoteBar counts={partyVoteCounts} />
        )}
      </section>

      {topicByVolume.length > 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Stemmer pr. emne
            </h2>
            <p className="mt-1 max-w-2xl text-xs text-[var(--color-muted)]">
              Hvordan {party.navn}s flertal stemte fordelt på emneord. Kun
              emner hvor partiet har stemt mindst {TOPIC_MIN_VOTES} gange er
              med.
            </p>
          </div>

          {(topicMostFor.length > 0 || topicMostImod.length > 0) && (
            <div className="grid gap-6 md:grid-cols-2">
              {topicMostFor.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-emerald-700">
                    Mest stemt for
                  </h3>
                  <ul className="space-y-1.5">
                    {topicMostFor.map((r) => (
                      <TopicRow
                        key={r.topic}
                        topic={r.topic}
                        forCount={r.for}
                        imodCount={r.imod}
                        hverkenCount={r.hverken}
                        total={r.total}
                        partyShort={short}
                      />
                    ))}
                  </ul>
                </div>
              )}
              {topicMostImod.length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-rose-700">
                    Mest stemt imod
                  </h3>
                  <ul className="space-y-1.5">
                    {topicMostImod.map((r) => (
                      <TopicRow
                        key={r.topic}
                        topic={r.topic}
                        forCount={r.for}
                        imodCount={r.imod}
                        hverkenCount={r.hverken}
                        total={r.total}
                        partyShort={short}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Hyppigste emner
            </h3>
            <ul className="space-y-1.5">
              {topicByVolume.map((r) => (
                <TopicRow
                  key={r.topic}
                  topic={r.topic}
                  forCount={r.for}
                  imodCount={r.imod}
                  hverkenCount={r.hverken}
                  total={r.total}
                  partyShort={short}
                />
              ))}
            </ul>
          </div>
        </section>
      )}

      {partyVoteRows.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Alle stemmer
          </h2>
          <p className="mb-4 max-w-2xl text-xs text-[var(--color-muted)]">
            Alle afstemninger hvor {party.navn}s flertal har taget stilling.
            Skift mellem fanerne for at se hvad partiet har stemt for, imod
            eller hverken for/imod.
          </p>
          <PartyVotesExplorer votes={partyVoteRows} partyName={party.navn} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Medlemmer pr. regering
        </h2>
        <div className="space-y-6">
          <GovernmentBlock
            heading="Aktive nu"
            members={currentMembers}
            party={party.color}
          />
          {governments.map((g) => {
            const list = membersDuring(members, short, g);
            if (list.length === 0) return null;
            return (
              <GovernmentBlock
                key={g.slug}
                heading={
                  <span className="flex items-baseline gap-3">
                    <Link
                      href={`/governments/${g.slug}`}
                      className="underline-offset-2 hover:underline"
                    >
                      {g.name}
                    </Link>
                    <span className="text-xs text-[var(--color-muted)]">
                      {formatDateRange(g)}
                    </span>
                  </span>
                }
                members={list}
                party={party.color}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

function GovernmentBlock({
  heading,
  members,
  party,
}: {
  heading: React.ReactNode;
  members: Member[];
  party: string;
}) {
  const sorted = [...members].sort((a, b) =>
    (a.efternavn ?? "").localeCompare(b.efternavn ?? "", "da"),
  );
  return (
    <div className="rounded-lg border px-4 py-3" style={{ borderColor: party }}>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <h3 className="text-sm font-medium">{heading}</h3>
        <span className="text-xs text-[var(--color-muted)] tabular-nums">
          {members.length}
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        {sorted.map((m) => (
          <li key={m.id}>
            <Link
              href={`/members/${m.id}`}
              className="block py-0.5 hover:underline"
            >
              {m.navn}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopicRow({
  topic,
  forCount,
  imodCount,
  hverkenCount,
  total,
  partyShort,
}: {
  topic: string;
  forCount: number;
  imodCount: number;
  hverkenCount: number;
  total: number;
  partyShort: string;
}) {
  const fp = total ? Math.round((forCount / total) * 100) : 0;
  const ip = total ? Math.round((imodCount / total) * 100) : 0;
  const hp = Math.max(0, 100 - fp - ip);
  return (
    <li>
      <Link
        href={`/topics/${encodeURIComponent(topic)}`}
        className="block rounded px-2 py-1.5 hover:bg-[var(--color-soft)]"
        title={`${partyShort}'s flertal: ${forCount} for · ${imodCount} imod · ${hverkenCount} hverken · ${total} i alt`}
      >
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate">{topic}</span>
          <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
            {forCount}/{total}
          </span>
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full">
          <div style={{ width: `${fp}%`, background: "#16a34a" }} />
          <div style={{ width: `${ip}%`, background: "#dc2626" }} />
          <div style={{ width: `${hp}%`, background: "#eab308" }} />
        </div>
      </Link>
    </li>
  );
}

function VoteBar({
  counts,
}: {
  counts: { for: number; imod: number; hverken: number; total: number };
}) {
  const decided = counts.for + counts.imod + counts.hverken;
  const pct = (n: number) => (decided ? (n / decided) * 100 : 0);
  return (
    <div className="space-y-2">
      <div className="flex h-3 overflow-hidden rounded-full">
        <div style={{ width: `${pct(counts.for)}%`, background: "#16a34a" }} />
        <div style={{ width: `${pct(counts.imod)}%`, background: "#dc2626" }} />
        <div style={{ width: `${pct(counts.hverken)}%`, background: "#eab308" }} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <Item color="#16a34a" label="For" count={counts.for} pct={pct(counts.for)} />
        <Item color="#dc2626" label="Imod" count={counts.imod} pct={pct(counts.imod)} />
        <Item color="#eab308" label="Hverken" count={counts.hverken} pct={pct(counts.hverken)} />
      </div>
    </div>
  );
}

function Item({
  color,
  label,
  count,
  pct,
}: {
  color: string;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <span className="inline-flex items-center gap-2 tabular-nums">
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {label} {count.toLocaleString("da-DK")} ({Math.round(pct)}%)
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-[var(--color-line)] p-3">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}
