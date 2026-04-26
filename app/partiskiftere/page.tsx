import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getMemberPartyHistory,
  getMembers,
  getParties,
} from "@/lib/data";
import type { MemberPartyHistory, Party } from "@/lib/types";

export const metadata = {
  title: "Partiskiftere — Magtinformation",
  description:
    "MF'er der har skiftet folketingsgruppe i løbet af deres karriere.",
};

export default async function Partiskiftere() {
  const [historyMap, members, parties] = await Promise.all([
    getMemberPartyHistory(),
    getMembers(),
    getParties(),
  ]);

  const memberById = new Map(members.map((m) => [m.id, m]));
  const partyByShort = new Map(parties.map((p) => [p.short, p]));

  type Row = {
    member: ReturnType<typeof memberById.get>;
    history: MemberPartyHistory;
    lastChange: string;
  };

  const rows: Row[] = [];
  for (const [idStr, history] of Object.entries(historyMap)) {
    if (!history.switched) continue;
    const member = memberById.get(Number(idStr));
    if (!member) continue;
    let lastChange = "";
    for (let i = 1; i < history.timeline.length; i++) {
      const start = history.timeline[i].start;
      if (start && start > lastChange) lastChange = start;
    }
    rows.push({ member, history, lastChange });
  }
  rows.sort(
    (a, b) =>
      Number(b.member!.isCurrentMF) - Number(a.member!.isCurrentMF) ||
      b.lastChange.localeCompare(a.lastChange),
  );

  const currentSwitchers = rows.filter((r) => r.member!.isCurrentMF);
  const formerSwitchers = rows.filter((r) => !r.member!.isCurrentMF);

  return (
    <div className="space-y-12">
      <section>
        <Link href="/" className="text-sm text-[var(--color-muted)]">
          ← Forside
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Partiskiftere
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          MF'er der har siddet for mere end én folketingsgruppe i den periode
          datasættet dækker. Tidslinjerne kommer fra Folketingets
          aktørrelationer (oda.ft.dk) — perioder hvor en MF har stået “uden
          for grupper” regnes også som en gruppe.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat
            label="Skiftere i alt"
            value={rows.length.toLocaleString("da-DK")}
          />
          <Stat
            label="Nuværende MF'er"
            value={currentSwitchers.length.toLocaleString("da-DK")}
          />
          <Stat
            label="Tidligere MF'er"
            value={formerSwitchers.length.toLocaleString("da-DK")}
          />
        </div>
      </section>

      {currentSwitchers.length > 0 && (
        <Section
          title="Nuværende MF'er"
          rows={currentSwitchers}
          partyByShort={partyByShort}
        />
      )}
      {formerSwitchers.length > 0 && (
        <Section
          title="Tidligere MF'er"
          rows={formerSwitchers}
          partyByShort={partyByShort}
        />
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  partyByShort,
}: {
  title: string;
  rows: {
    member: { id: number; navn: string; isCurrentMF: boolean } | undefined;
    history: MemberPartyHistory;
    lastChange: string;
  }[];
  partyByShort: Map<string, Party>;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
        {title} ({rows.length.toLocaleString("da-DK")})
      </h2>
      <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {rows.map(({ member, history, lastChange }) => {
          if (!member) return null;
          return (
            <li key={member.id}>
              <Link
                href={`/members/${member.id}`}
                className="block py-3 hover:bg-[var(--color-soft)]"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <div className="font-medium">{member.navn}</div>
                  <div className="text-xs tabular-nums text-[var(--color-muted)]">
                    {history.distinctParties.length} grupper
                    {lastChange ? ` · seneste skift ${lastChange}` : ""}
                  </div>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {history.timeline.map((t, idx) => {
                    const p = partyByShort.get(t.partyShort);
                    return (
                      <span
                        key={`${t.partyShort}-${t.start ?? idx}`}
                        className="flex items-center gap-1"
                      >
                        <PartyBadge party={p} size="sm" />
                        {idx < history.timeline.length - 1 && (
                          <span className="text-[var(--color-muted)]">→</span>
                        )}
                      </span>
                    );
                  })}
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    {history.timeline
                      .map((t) => partyByShort.get(t.partyShort)?.navn ?? t.partyName)
                      .join(" → ")}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-3">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
