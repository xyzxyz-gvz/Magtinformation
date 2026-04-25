import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import { getMembers, getParties } from "@/lib/data";

export default async function PartiesIndex() {
  const [parties, members] = await Promise.all([getParties(), getMembers()]);

  const currentByParty = new Map<string, number>();
  const everByParty = new Map<string, number>();
  for (const m of members) {
    everByParty.set(m.partyShort, (everByParty.get(m.partyShort) ?? 0) + 1);
    if (m.isCurrentMF) {
      currentByParty.set(
        m.partyShort,
        (currentByParty.get(m.partyShort) ?? 0) + 1,
      );
    }
  }

  const sorted = parties
    .filter((p) => everByParty.has(p.short))
    .sort((a, b) => a.left_order - b.left_order);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Partier</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Alle partier der har haft mindst ét medlem i Folketinget i datasættet.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sorted.map((p) => {
          const current = currentByParty.get(p.short) ?? 0;
          const ever = everByParty.get(p.short) ?? 0;
          return (
            <li key={p.short}>
              <Link
                href={`/parties/${p.short}`}
                className="flex items-center gap-4 rounded-lg border-2 px-4 py-3 hover:bg-[var(--color-soft)]"
                style={{ borderColor: p.color }}
              >
                <PartyBadge party={p} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.navn}</div>
                  <div className="text-xs text-[var(--color-muted)] tabular-nums">
                    {current > 0 ? `${current} nuværende · ` : ""}
                    {ever} i alt
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
