import type { EnrichedVote, Member, Party } from "@/lib/types";
import { VoteBreakdownClient, type BreakdownGroup } from "./VoteBreakdownClient";

type Props = {
  vote: EnrichedVote;
  members: Member[];
  parties: Party[];
};

export function VoteBreakdown({ vote, members, parties }: Props) {
  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const map = new Map<string, BreakdownGroup>();
  for (const s of vote.stemmer) {
    const m = memberById.get(s.aktørid);
    if (!m) continue;
    const key = m.partyShort;
    let row = map.get(key);
    if (!row) {
      const p = partyByShort.get(key);
      row = {
        partyShort: key,
        partyName: p?.navn ?? key,
        partyLetter: p?.letter ?? "?",
        partyColor: p?.color ?? "#cbd5e1",
        partyOrder: p?.left_order ?? 99,
        members: [],
        counts: { for: 0, imod: 0, fravær: 0, hverken: 0 },
      };
      map.set(key, row);
    }
    row.members.push({ id: m.id, navn: m.navn, voteType: s.typeid });
    if (s.typeid === 1) row.counts.for++;
    else if (s.typeid === 2) row.counts.imod++;
    else if (s.typeid === 3) row.counts.fravær++;
    else if (s.typeid === 4) row.counts.hverken++;
  }

  const groups = [...map.values()].sort(
    (a, b) =>
      a.partyOrder - b.partyOrder || a.partyShort.localeCompare(b.partyShort),
  );
  for (const g of groups) {
    g.members.sort(
      (a, b) => a.voteType - b.voteType || a.navn.localeCompare(b.navn, "da"),
    );
  }

  return <VoteBreakdownClient groups={groups} />;
}
