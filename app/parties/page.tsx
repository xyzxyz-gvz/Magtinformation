import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import { buttonVariants } from "@/components/ui/button";
import {
  getMembers,
  getParties,
  getVoteMajorities,
  getVotesList,
} from "@/lib/data";
import { cn } from "@/lib/utils";

type PartyRow = {
  short: string;
  navn: string;
  letter: string;
  color: string;
  left_order: number;
  current: number;
  ever: number;
  decisive: number;
  forCount: number;
  imodCount: number;
  hverkenCount: number;
  avgAge: number | null;
};

function ageAt(born: string | null, refISO: string): number | null {
  if (!born) return null;
  const b = new Date(born);
  const r = new Date(refISO);
  if (isNaN(b.getTime()) || isNaN(r.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const dm = r.getMonth() - b.getMonth();
  if (dm < 0 || (dm === 0 && r.getDate() < b.getDate())) age--;
  return age;
}

export default async function PartiesIndex() {
  const [parties, members, votes, majorities] = await Promise.all([
    getParties(),
    getMembers(),
    getVotesList(),
    getVoteMajorities(),
  ]);

  const everByParty = new Map<string, number>();
  const currentByParty = new Map<string, number>();
  // Sum + count of ages of current MFs per party, for average
  const ageSumByParty = new Map<string, number>();
  const ageCountByParty = new Map<string, number>();
  const today = new Date().toISOString().slice(0, 10);
  for (const m of members) {
    everByParty.set(m.partyShort, (everByParty.get(m.partyShort) ?? 0) + 1);
    if (m.isCurrentMF) {
      currentByParty.set(
        m.partyShort,
        (currentByParty.get(m.partyShort) ?? 0) + 1,
      );
      const a = ageAt(m.born, today);
      if (a != null && a >= 18 && a <= 110) {
        ageSumByParty.set(
          m.partyShort,
          (ageSumByParty.get(m.partyShort) ?? 0) + a,
        );
        ageCountByParty.set(
          m.partyShort,
          (ageCountByParty.get(m.partyShort) ?? 0) + 1,
        );
      }
    }
  }

  const stance = new Map<
    string,
    { for: number; imod: number; hverken: number; total: number }
  >();
  for (const v of votes) {
    const m = majorities[String(v.id)];
    if (!m) continue;
    for (const [pShort, t] of Object.entries(m)) {
      if (t !== 1 && t !== 2 && t !== 4) continue;
      const row = stance.get(pShort) ?? {
        for: 0,
        imod: 0,
        hverken: 0,
        total: 0,
      };
      row.total++;
      if (t === 1) row.for++;
      else if (t === 2) row.imod++;
      else if (t === 4) row.hverken++;
      stance.set(pShort, row);
    }
  }

  const rows: PartyRow[] = parties
    .filter((p) => everByParty.has(p.short))
    .map((p) => {
      const s = stance.get(p.short) ?? {
        for: 0,
        imod: 0,
        hverken: 0,
        total: 0,
      };
      const ageSum = ageSumByParty.get(p.short) ?? 0;
      const ageN = ageCountByParty.get(p.short) ?? 0;
      return {
        short: p.short,
        navn: p.navn,
        letter: p.letter,
        color: p.color,
        left_order: p.left_order,
        current: currentByParty.get(p.short) ?? 0,
        ever: everByParty.get(p.short) ?? 0,
        decisive: s.total,
        forCount: s.for,
        imodCount: s.imod,
        hverkenCount: s.hverken,
        avgAge: ageN > 0 ? Math.round(ageSum / ageN) : null,
      };
    });

  const currentRows = rows
    .filter((r) => r.current > 0)
    .sort((a, b) => a.left_order - b.left_order);
  const historicalRows = rows
    .filter((r) => r.current === 0)
    .sort((a, b) => a.navn.localeCompare(b.navn, "da"));

  // Editorial highlights: youngest + oldest party by current MF age average.
  // Only consider parties with a meaningful sample size.
  const ageRanked = currentRows
    .filter((r) => r.avgAge != null && r.current >= 3)
    .sort((a, b) => (a.avgAge ?? 0) - (b.avgAge ?? 0));
  const youngest = ageRanked[0] ?? null;
  const oldest = ageRanked[ageRanked.length - 1] ?? null;
  const showAgeHighlight =
    youngest && oldest && youngest.short !== oldest.short;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Partier</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
            Alle partier der har haft mindst ét medlem i Folketinget i
            datasættet. Klik for fuld profil med stemmer, emner og medlemmer
            — eller sammenlign to partier direkte.
          </p>
        </div>
        <Link
          href="/parties/sammenlign"
          className={cn(buttonVariants({ size: "default" }))}
        >
          Sammenlign to partier
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {showAgeHighlight && (
        <div className="grid gap-3 sm:grid-cols-2">
          <AgeCallout label="Yngste parti" row={youngest!} />
          <AgeCallout label="Ældste parti" row={oldest!} />
        </div>
      )}

      {currentRows.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Nuværende partier ({currentRows.length})
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {currentRows.map((r) => (
              <PartyCard key={r.short} row={r} />
            ))}
          </ul>
        </section>
      )}

      {historicalRows.length > 0 && (
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
            Tidligere partier ({historicalRows.length})
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {historicalRows.map((r) => (
              <PartyCard key={r.short} row={r} historical />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AgeCallout({
  label,
  row,
}: {
  label: string;
  row: PartyRow;
}) {
  return (
    <Link
      href={`/parties/${row.short}`}
      className="flex items-center gap-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-soft)] p-4 no-underline hover:bg-white hover:no-underline"
    >
      <PartyBadge
        party={{
          short: row.short,
          navn: row.navn,
          letter: row.letter,
          color: row.color,
          left_order: row.left_order,
        }}
        size="md"
      />
      <div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-semibold">{row.navn}</div>
        <div className="text-xs tabular-nums text-[var(--color-muted)]">
          gennemsnitsalder {row.avgAge} år · {row.current} MF'er
        </div>
      </div>
    </Link>
  );
}

function PartyCard({
  row,
  historical = false,
}: {
  row: PartyRow;
  historical?: boolean;
}) {
  const decided = row.forCount + row.imodCount + row.hverkenCount;
  const pct = (n: number) => (decided ? Math.round((n / decided) * 100) : 0);
  return (
    <li>
      <Link
        href={`/parties/${row.short}`}
        className="group flex h-full flex-col rounded-xl border-2 bg-white p-4 no-underline transition hover:-translate-y-0.5 hover:shadow-sm hover:no-underline"
        style={{ borderColor: row.color }}
      >
        <div className="flex items-center gap-3">
          <PartyBadge
            party={{
              short: row.short,
              navn: row.navn,
              letter: row.letter,
              color: row.color,
              left_order: row.left_order,
            }}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold">{row.navn}</div>
            <div className="flex flex-wrap gap-x-2 text-xs tabular-nums text-[var(--color-muted)]">
              {historical ? (
                <span>{row.ever} medlemmer i alt</span>
              ) : (
                <>
                  <span>{row.current} nuværende</span>
                  <span>· {row.ever} i alt</span>
                  {row.avgAge != null && (
                    <span>· snit {row.avgAge} år</span>
                  )}
                </>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--color-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-ink)]" />
        </div>

        {decided > 0 && (
          <div className="mt-4">
            <div className="flex h-1.5 overflow-hidden rounded-full">
              <div
                style={{
                  width: `${pct(row.forCount)}%`,
                  background: "#16a34a",
                }}
              />
              <div
                style={{
                  width: `${pct(row.imodCount)}%`,
                  background: "#dc2626",
                }}
              />
              <div
                style={{
                  width: `${pct(row.hverkenCount)}%`,
                  background: "#eab308",
                }}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] tabular-nums text-[var(--color-muted)]">
              <span>For {pct(row.forCount)}%</span>
              <span>Imod {pct(row.imodCount)}%</span>
              {row.hverkenCount > 0 && (
                <span>Hverken {pct(row.hverkenCount)}%</span>
              )}
              <span className="ml-auto">
                {row.decisive.toLocaleString("da-DK")} afstemninger
              </span>
            </div>
          </div>
        )}
      </Link>
    </li>
  );
}
