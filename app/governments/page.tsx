import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getGovernmentMembers,
  getGovernments,
  getParties,
  getVotesList,
} from "@/lib/data";
import { formatDateRange } from "@/lib/governments";

export const metadata = {
  title: "Regeringer — Magtinformation",
  description: "Oversigt over de regeringer datasættet dækker.",
};

const SEATS = 179;

export default async function GovernmentsIndex() {
  const [governments, parties, votes, govMembersMap] = await Promise.all([
    getGovernments(),
    getParties(),
    getVotesList(),
    getGovernmentMembers(),
  ]);

  const partyByShort = new Map(parties.map((p) => [p.short, p]));

  const sorted = [...governments].sort((a, b) =>
    b.start.localeCompare(a.start),
  );

  const rows = sorted.map((g) => {
    const periodVotes = votes.filter(
      (v) => v.dato >= g.start && (g.end === null || v.dato < g.end),
    );
    const passed = periodVotes.filter((v) => v.vedtaget).length;
    const passRate = periodVotes.length
      ? Math.round((passed / periodVotes.length) * 100)
      : 0;
    const memberRows = govMembersMap[g.slug] ?? [];
    const totalMembers = memberRows.length;
    const substituteCount = Math.max(0, totalMembers - SEATS);
    return {
      gov: g,
      voteCount: periodVotes.length,
      passed,
      passRate,
      totalMembers,
      substituteCount,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Regeringer</h1>
        <p className="mt-2 max-w-2xl text-[var(--color-muted)]">
          De {governments.length} regeringer datasættet dækker. Klik på en
          regering for at se sammensætning, demografi og hvad der blev stemt
          om i perioden.
        </p>
      </div>

      <ul className="space-y-3">
        {rows.map(({ gov, voteCount, passed, passRate, totalMembers, substituteCount }) => (
          <li key={gov.slug}>
            <Link
              href={`/governments/${gov.slug}`}
              className="block rounded-lg border border-[var(--color-line)] p-5 hover:bg-[var(--color-soft)]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-3">
                  <h2 className="text-lg font-semibold">{gov.name}</h2>
                  {gov.end === null && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800">
                      Siddende
                    </span>
                  )}
                </div>
                <div className="text-sm tabular-nums text-[var(--color-muted)]">
                  {formatDateRange(gov)}
                </div>
              </div>

              <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted)]">
                {gov.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {gov.parties.map((short) => {
                  const p = partyByShort.get(short);
                  return (
                    <span
                      key={short}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-2.5 py-0.5 text-xs"
                    >
                      <PartyBadge party={p} size="sm" />
                      {p?.navn ?? short}
                    </span>
                  );
                })}
                <span className="text-xs text-[var(--color-muted)]">
                  · {gov.type.toLowerCase()}
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <Stat label="Afstemninger" value={voteCount.toLocaleString("da-DK")} />
                <Stat
                  label="Vedtaget"
                  value={`${passed.toLocaleString("da-DK")}`}
                  hint={`${passRate}%`}
                />
                <Stat
                  label="MF'er i alt"
                  value={totalMembers.toLocaleString("da-DK")}
                />
                <Stat
                  label="Stedfortrædere"
                  value={substituteCount.toLocaleString("da-DK")}
                  hint="ud over de 179 sæder"
                />
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </div>
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
    <div>
      <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 flex items-baseline gap-2">
        <span className="text-base font-semibold tabular-nums">{value}</span>
        {hint && (
          <span className="text-xs text-[var(--color-muted)]">{hint}</span>
        )}
      </dd>
    </div>
  );
}
