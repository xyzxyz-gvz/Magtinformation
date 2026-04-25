import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import { getMembers, getParties } from "@/lib/data";
import type { Member } from "@/lib/types";

export default async function MembersIndex() {
  const [members, parties] = await Promise.all([getMembers(), getParties()]);

  const current = members.filter((m) => m.isCurrentMF);
  const byParty = new Map<string, Member[]>();
  for (const m of current) {
    const list = byParty.get(m.partyShort) ?? [];
    list.push(m);
    byParty.set(m.partyShort, list);
  }

  const partyList = parties
    .filter((p) => byParty.has(p.short))
    .sort((a, b) => a.left_order - b.left_order);

  return (
    <div className="space-y-10">
      <div className="flex items-baseline justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Medlemmer</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {current.length} nuværende folketingsmedlemmer.
          </p>
        </div>
        <Link
          href="/members/oprorere"
          className="text-sm underline-offset-2 hover:underline"
        >
          Oprørere →
        </Link>
      </div>

      {partyList.map((party) => {
        const list = byParty.get(party.short) ?? [];
        list.sort((a, b) => (a.efternavn ?? "").localeCompare(b.efternavn ?? ""));
        return (
          <section key={party.short}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium">
              <PartyBadge party={party} size="sm" />
              {party.navn}
              <span className="text-[var(--color-muted)]">
                · {list.length}
              </span>
            </h2>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              {list.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/members/${m.id}`}
                    className="block py-1 text-sm hover:underline"
                  >
                    {m.navn}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
