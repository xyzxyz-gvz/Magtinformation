import { PartyBadge } from "@/components/PartyBadge";
import type { EnrichedVote, Member, Party } from "@/lib/types";
import { VOTE_COLORS, VOTE_LABELS } from "@/lib/types";

type Props = {
  vote: EnrichedVote;
  members: Member[];
  parties: Party[];
};

type GroupRow = {
  party: Party | undefined;
  partyShort: string;
  members: { id: number; navn: string; voteType: number }[];
  counts: { for: number; imod: number; fravær: number; hverken: number };
};

export function VoteBreakdown({ vote, members, parties }: Props) {
  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const groups = new Map<string, GroupRow>();
  for (const s of vote.stemmer) {
    const m = memberById.get(s.aktørid);
    if (!m) continue;
    const key = m.partyShort;
    let row = groups.get(key);
    if (!row) {
      row = {
        party: partyByShort.get(key),
        partyShort: key,
        members: [],
        counts: { for: 0, imod: 0, fravær: 0, hverken: 0 },
      };
      groups.set(key, row);
    }
    row.members.push({ id: m.id, navn: m.navn, voteType: s.typeid });
    if (s.typeid === 1) row.counts.for++;
    else if (s.typeid === 2) row.counts.imod++;
    else if (s.typeid === 3) row.counts.fravær++;
    else if (s.typeid === 4) row.counts.hverken++;
  }

  const ordered = [...groups.values()].sort(
    (a, b) =>
      (a.party?.left_order ?? 99) - (b.party?.left_order ?? 99) ||
      a.partyShort.localeCompare(b.partyShort),
  );

  return (
    <div className="space-y-2">
      {ordered.map((row) => {
        row.members.sort((a, b) => a.voteType - b.voteType);
        const total = row.members.length;
        return (
          <div
            key={row.partyShort}
            className="rounded-lg border px-3 py-2.5"
            style={{ borderColor: row.party?.color ?? "#cbd5e1" }}
          >
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="flex items-center gap-2">
                <PartyBadge party={row.party} size="sm" />
                <span className="text-sm font-medium">
                  {row.party?.navn ?? row.partyShort}
                </span>
                <span className="text-xs text-[var(--color-muted)] tabular-nums">
                  {total}
                </span>
              </div>
              <div className="ml-auto flex gap-3 text-xs tabular-nums text-[var(--color-muted)]">
                <Tally type={1} count={row.counts.for} />
                <Tally type={2} count={row.counts.imod} />
                <Tally type={3} count={row.counts.fravær} />
                {row.counts.hverken > 0 && (
                  <Tally type={4} count={row.counts.hverken} />
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {row.members.map((m) => (
                <span
                  key={m.id}
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: VOTE_COLORS[m.voteType] }}
                  title={`${m.navn} — ${VOTE_LABELS[m.voteType] ?? "?"}`}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tally({ type, count }: { type: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: VOTE_COLORS[type] }}
      />
      {count} {VOTE_LABELS[type]?.toLowerCase()}
    </span>
  );
}
