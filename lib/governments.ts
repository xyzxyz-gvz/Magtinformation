import type { Government, MemberPartyHistory } from "./types";

export function getGovernmentForDate(
  governments: Government[],
  date: string | null | undefined,
): Government | null {
  if (!date) return null;
  for (const g of governments) {
    if (date >= g.start && (g.end === null || date < g.end)) {
      return g;
    }
  }
  return null;
}

export function formatDateRange(g: Government): string {
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    const months = [
      "jan", "feb", "mar", "apr", "maj", "jun",
      "jul", "aug", "sep", "okt", "nov", "dec",
    ];
    return `${months[Number(m) - 1]}. ${y}`;
  };
  const start = fmt(g.start);
  const end = g.end ? fmt(g.end) : "nu";
  return `${start} – ${end}`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

export type MemberVoteForBucket = {
  d: string;
  t: number;
  dev: boolean;
};

export type GovernmentBucket = {
  government: Government | null;
  total: number;
  present: number;
  absent: number;
  hverken: number;
  deviation: number;
  fremmødePct: number | null;
  afvigelsePct: number | null;
};

/**
 * Bucket a member's votes by government period and compute attendance + deviation
 * per government. Returns an entry for every government where the MF cast at least
 * one vote (or was registered as fravær), ordered newest first.
 */
export function bucketMemberVotesByGovernment(
  votes: MemberVoteForBucket[],
  governments: Government[],
): GovernmentBucket[] {
  const sorted = [...governments].sort((a, b) => b.start.localeCompare(a.start));
  const map = new Map<string, GovernmentBucket>();
  let none: GovernmentBucket | null = null;

  for (const v of votes) {
    const gov = sorted.find(
      (g) => v.d >= g.start && (g.end === null || v.d < g.end),
    );
    let bucket: GovernmentBucket;
    if (!gov) {
      none ??= emptyBucket(null);
      bucket = none;
    } else {
      let b = map.get(gov.slug);
      if (!b) {
        b = emptyBucket(gov);
        map.set(gov.slug, b);
      }
      bucket = b;
    }
    bucket.total++;
    if (v.t === 3) bucket.absent++;
    else bucket.present++;
    if (v.t === 4) bucket.hverken++;
    if (v.dev) bucket.deviation++;
  }

  for (const b of map.values()) finalizeBucket(b);
  if (none) finalizeBucket(none);

  const ordered: GovernmentBucket[] = [];
  for (const g of sorted) {
    const b = map.get(g.slug);
    if (b) ordered.push(b);
  }
  if (none) ordered.push(none);
  return ordered;
}

function emptyBucket(gov: Government | null): GovernmentBucket {
  return {
    government: gov,
    total: 0,
    present: 0,
    absent: 0,
    hverken: 0,
    deviation: 0,
    fremmødePct: null,
    afvigelsePct: null,
  };
}

function finalizeBucket(b: GovernmentBucket): void {
  b.fremmødePct = b.total ? Math.round((b.present / b.total) * 100) : null;
  b.afvigelsePct = b.present
    ? Math.round((b.deviation / b.present) * 100)
    : null;
}

/**
 * Resolve which folketingsgruppe an MF belonged to at the start of a given
 * government period. Falls back to the earliest entry that overlaps the
 * period (useful for stedfortrædere who joined mid-period). Returns null if
 * no overlapping entry exists at all.
 *
 * Without this, partifordelingen pr. regering ender med at vise MF'ens
 * NUVÆRENDE parti — så fx Moderaterne under Frederiksen II viser 12 i
 * stedet for de 16 mandater partiet fik ved 2022-valget, fordi 4 MF'er
 * har skiftet undervejs.
 */
export function partyAtPeriodStart(
  history: MemberPartyHistory | undefined,
  periodStart: string,
  periodEnd: string | null,
): string | null {
  if (!history) return null;
  const FAR_PAST = "0000-00-00";
  const FAR_FUTURE = "9999-99-99";
  const end = periodEnd ?? FAR_FUTURE;

  // 1. Entry that contains the period start
  for (const t of history.timeline) {
    const s = t.start ?? FAR_PAST;
    const e = t.end ?? FAR_FUTURE;
    if (s <= periodStart && periodStart < e) return t.partyShort;
  }
  // 2. Else earliest entry that overlaps the period at all
  for (const t of history.timeline) {
    const s = t.start ?? FAR_PAST;
    const e = t.end ?? FAR_FUTURE;
    if (s < end && e > periodStart) return t.partyShort;
  }
  return null;
}
