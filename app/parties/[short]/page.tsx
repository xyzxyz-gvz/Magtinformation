import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getGovernments,
  getMembers,
  getParties,
  getVoteMajorities,
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
  const [parties, members, governments, votes, majorities] = await Promise.all([
    getParties(),
    getMembers(),
    getGovernments(),
    getVotesList(),
    getVoteMajorities(),
  ]);

  const party = parties.find((p) => p.short === short);
  if (!party) notFound();

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
