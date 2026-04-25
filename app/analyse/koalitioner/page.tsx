import Link from "next/link";
import { AnalyseFilter } from "@/components/AnalyseFilter";
import { PartyBadge } from "@/components/PartyBadge";
import { computeAgreement } from "@/lib/agreement";
import {
  getGovernments,
  getParties,
  getVoteMajorities,
  getVotesList,
} from "@/lib/data";

export default async function KoalitionerPage({
  searchParams,
}: {
  searchParams: Promise<{ gov?: string; topic?: string }>;
}) {
  const sp = await searchParams;
  const govSlug = sp.gov ?? "";
  const topicFilter = sp.topic ?? "";

  const [parties, governments, votes, majorities] = await Promise.all([
    getParties(),
    getGovernments(),
    getVotesList(),
    getVoteMajorities(),
  ]);

  if (Object.keys(majorities).length === 0) {
    return <Empty />;
  }

  const partyByShort = new Map(parties.map((p) => [p.short, p]));

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

  const gov = governments.find((g) => g.slug === govSlug) ?? null;

  let filtered = votes;
  if (gov) {
    filtered = filtered.filter(
      (v) => v.dato >= gov.start && (gov.end === null || v.dato < gov.end),
    );
  }
  if (topicFilter) {
    filtered = filtered.filter((v) => (v.topics ?? []).includes(topicFilter));
  }

  const partyOrder = parties
    .filter((p) => p.short !== "UFG")
    .sort((a, b) => a.left_order - b.left_order)
    .map((p) => p.short);

  const minShared = gov || topicFilter ? 10 : 50;
  const agreement = computeAgreement(
    filtered.map((v) => v.id),
    majorities,
    partyOrder,
    minShared,
  );

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-[var(--color-muted)]">
          ← Forside
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Partienighed
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
          Hvor ofte stemmer to partier ens? Cellen viser andelen af
          afstemninger hvor begge partiers flertal stemte det samme. Filtrér
          på regering eller emne for at se mønstre i et bestemt domæne.
        </p>
      </div>

      <AnalyseFilter
        governments={governments}
        topics={topics}
        govSlug={govSlug}
        topic={topicFilter}
      />

      <div className="flex items-baseline justify-between gap-6">
        <div className="text-sm text-[var(--color-muted)]">
          Baseret på {agreement.voteCount.toLocaleString("da-DK")} afstemninger
          {gov && ` under ${gov.name}`}
          {topicFilter && ` om "${topicFilter}"`}.
        </div>
        <Legend />
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white p-1" />
              {partyOrder.map((short) => (
                <th key={short} className="p-1 align-bottom">
                  <PartyBadge party={partyByShort.get(short)} size="sm" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partyOrder.map((rowShort, i) => (
              <tr key={rowShort}>
                <th className="sticky left-0 z-10 bg-white py-1 pr-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-xs">
                      {partyByShort.get(rowShort)?.navn ?? rowShort}
                    </span>
                    <PartyBadge party={partyByShort.get(rowShort)} size="sm" />
                  </div>
                </th>
                {partyOrder.map((colShort, j) => {
                  const value = agreement.matrix[i]?.[j];
                  const shared = agreement.shared[i]?.[j] ?? 0;
                  return (
                    <Cell
                      key={colShort}
                      value={value ?? null}
                      shared={shared}
                      diagonal={i === j}
                      label={`${partyByShort.get(rowShort)?.navn ?? rowShort} vs ${partyByShort.get(colShort)?.navn ?? colShort}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Tomme celler: færre end {minShared} fælles afstemninger i det
        filtrerede sæt. Diagonalen er per definition 100 %.
      </p>
    </div>
  );
}

function Cell({
  value,
  shared,
  diagonal,
  label,
}: {
  value: number | null;
  shared: number;
  diagonal: boolean;
  label: string;
}) {
  if (diagonal) {
    return (
      <td className="h-12 w-12 border border-[var(--color-line)] bg-[var(--color-ink)] text-center text-xs font-medium text-white">
        —
      </td>
    );
  }
  if (value === null) {
    return (
      <td
        className="h-12 w-12 border border-[var(--color-line)] bg-[var(--color-soft)] text-center text-xs text-[var(--color-muted)]"
        title={`${label} — for få fælles afstemninger`}
      >
        ·
      </td>
    );
  }
  const pct = Math.round(value * 100);
  const bg = colorFor(value);
  const fg = value > 0.55 ? "#fff" : "#111418";
  return (
    <td
      className="h-12 w-12 border border-[var(--color-line)] text-center text-xs font-medium tabular-nums"
      style={{ background: bg, color: fg }}
      title={`${label} — ${pct}% (${shared.toLocaleString("da-DK")} fælles)`}
    >
      {pct}
    </td>
  );
}

function colorFor(v: number): string {
  const t = Math.max(0, Math.min(1, v));
  if (t < 0.5) {
    const k = t / 0.5;
    const r = Math.round(245 - (245 - 250) * k);
    const g = Math.round(220 - (220 - 240) * k);
    const b = Math.round(220 - (220 - 240) * k);
    return `rgb(${r}, ${g}, ${b})`;
  }
  const k = (t - 0.5) / 0.5;
  const r = Math.round(250 - (250 - 15) * k);
  const g = Math.round(240 - (240 - 95) * k);
  const b = Math.round(240 - (240 - 80) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

function Legend() {
  const stops = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
      <span>Lav</span>
      <div className="flex">
        {stops.map((v) => (
          <span
            key={v}
            className="inline-block h-3 w-8 border border-[var(--color-line)]"
            style={{ background: colorFor(v) }}
          />
        ))}
      </div>
      <span>Høj</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">Partienighed</h1>
      <p className="text-sm text-[var(--color-muted)]">
        Ingen data endnu. Kør pipeline:
      </p>
      <pre className="rounded bg-[var(--color-soft)] p-3 text-xs">
        python -m pipeline.preprocess
      </pre>
    </div>
  );
}
