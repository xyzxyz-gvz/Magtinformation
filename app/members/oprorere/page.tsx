import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import { getMembers, getParties } from "@/lib/data";

const MIN_VOTES = 50;
const TOP_N = 30;

export default async function OprorerePage() {
  const [members, parties] = await Promise.all([getMembers(), getParties()]);
  const partyByShort = new Map(parties.map((p) => [p.short, p]));

  const ranked = members
    .filter(
      (m) =>
        m.isCurrentMF &&
        m.afvigelsePct != null &&
        m.afstemningerTotal >= MIN_VOTES,
    )
    .sort((a, b) => (b.afvigelsePct ?? 0) - (a.afvigelsePct ?? 0))
    .slice(0, TOP_N);

  const maxPct = ranked[0]?.afvigelsePct ?? 1;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/members" className="text-sm text-[var(--color-muted)]">
          ← Medlemmer
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Oprørere
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
          De {TOP_N} folketingsmedlemmer der oftest stemmer imod deres eget
          partis flertal. Kun medlemmer med mindst {MIN_VOTES} afstemninger.
        </p>
      </div>

      <ol className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {ranked.map((m, i) => {
          const party = partyByShort.get(m.partyShort);
          const pct = m.afvigelsePct ?? 0;
          const barWidth = `${(pct / maxPct) * 100}%`;
          return (
            <li key={m.id}>
              <Link
                href={`/members/${m.id}`}
                className="grid grid-cols-[2rem_1.5rem_1fr_8rem_4rem] items-center gap-4 py-3 hover:bg-[var(--color-soft)]"
              >
                <span className="text-sm tabular-nums text-[var(--color-muted)]">
                  {i + 1}
                </span>
                <PartyBadge party={party} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.navn}</div>
                  <div className="truncate text-xs text-[var(--color-muted)]">
                    {party?.navn ?? m.partyShort} ·{" "}
                    {m.afstemningerTotal.toLocaleString("da-DK")} afstemninger
                  </div>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-soft)]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: barWidth,
                      background: party?.color ?? "#999",
                    }}
                  />
                </div>
                <div className="text-right text-sm font-semibold tabular-nums">
                  {pct}%
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
