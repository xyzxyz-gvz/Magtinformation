import Link from "next/link";
import { CompareMemberPicker } from "@/components/CompareMemberPicker";
import { EmptyState } from "@/components/EmptyState";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getMember,
  getMemberVotes,
  getParties,
  getVoteTopics,
} from "@/lib/data";
import type { Member, MemberVote, Party } from "@/lib/types";
import { VOTE_LABELS } from "@/lib/types";

export const metadata = {
  title: "Sammenlign MF'er — Magtinformation",
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const sp = await searchParams;
  const idA = Number(sp.a);
  const idB = Number(sp.b);
  const haveBoth =
    Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB;

  const [parties] = await Promise.all([getParties()]);
  const partyByShort = new Map(parties.map((p) => [p.short, p]));

  const [memberA, memberB, votesA, votesB, voteTopics] = haveBoth
    ? await Promise.all([
        getMember(idA),
        getMember(idB),
        getMemberVotes(idA),
        getMemberVotes(idB),
        getVoteTopics(),
      ])
    : [null, null, [], [], {} as Record<string, string[]>];

  return (
    <div className="space-y-10">
      <div>
        <Link href="/members" className="text-sm text-[var(--color-muted)]">
          ← Medlemmer
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Sammenlign to MF'er
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          Vælg to MF'er for at se deres profiler side om side, hvor enige de
          har stemt, og hvilke afstemninger de har stemt forskelligt om.
        </p>
      </div>

      <CompareMemberPicker
        initialA={sp.a ?? ""}
        initialB={sp.b ?? ""}
      />

      {!haveBoth ? (
        <EmptyState
          title="Vælg to MF'er at sammenligne"
          body="Brug felterne ovenfor — du kan søge på navn. Sammenligningen viser fælles afstemninger, hvor enige de stemte, og en liste over de afstemninger de var uenige om."
        />
      ) : !memberA || !memberB ? (
        <EmptyState title="Den ene MF kunne ikke findes" />
      ) : (
        <Comparison
          a={memberA}
          b={memberB}
          votesA={votesA}
          votesB={votesB}
          partyByShort={partyByShort}
          voteTopics={voteTopics}
        />
      )}
    </div>
  );
}

function Comparison({
  a,
  b,
  votesA,
  votesB,
  partyByShort,
  voteTopics,
}: {
  a: Member;
  b: Member;
  votesA: MemberVote[];
  votesB: MemberVote[];
  partyByShort: Map<string, Party>;
  voteTopics: Record<string, string[]>;
}) {
  const partyA = partyByShort.get(a.partyShort);
  const partyB = partyByShort.get(b.partyShort);

  const mapA = new Map(votesA.map((v) => [v.id, v]));
  const mapB = new Map(votesB.map((v) => [v.id, v]));
  const sharedIds = [...mapA.keys()].filter((id) => mapB.has(id));

  let bothPresent = 0;
  let agree = 0;
  let disagree = 0;
  const disagreements: { id: number; d: string; ct: string | null; tA: number; tB: number }[] = [];
  for (const id of sharedIds) {
    const va = mapA.get(id)!;
    const vb = mapB.get(id)!;
    if (va.t === 3 || vb.t === 3) continue;
    bothPresent++;
    if (va.t === vb.t) agree++;
    else {
      disagree++;
      disagreements.push({ id, d: va.d, ct: va.ct, tA: va.t, tB: vb.t });
    }
  }
  const agreementPct = bothPresent
    ? Math.round((agree / bothPresent) * 100)
    : null;

  disagreements.sort((x, y) => y.d.localeCompare(x.d));

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        <ProfileCard member={a} party={partyA} />
        <ProfileCard member={b} party={partyB} />
      </div>

      <section className="rounded-lg border border-[var(--color-line)] p-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Enighed
        </h2>
        {agreementPct == null ? (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Ingen fælles afstemninger hvor begge var til stede.
          </p>
        ) : (
          <>
            <div className="mt-3 flex items-baseline gap-3">
              <div className="text-4xl font-semibold tabular-nums">
                {agreementPct}%
              </div>
              <div className="text-sm text-[var(--color-muted)]">
                stemte ens i {agree.toLocaleString("da-DK")} af{" "}
                {bothPresent.toLocaleString("da-DK")} fælles afstemninger
              </div>
            </div>
            <div className="mt-3 flex h-2.5 overflow-hidden rounded-full">
              <div
                style={{
                  width: `${(agree / bothPresent) * 100}%`,
                  background: "#16a34a",
                }}
              />
              <div
                style={{
                  width: `${(disagree / bothPresent) * 100}%`,
                  background: "#dc2626",
                }}
              />
            </div>
          </>
        )}
      </section>

      {disagreements.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Stemte forskelligt
          </h2>
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {disagreements.slice(0, 50).map((d) => (
              <li key={d.id}>
                <Link
                  href={`/votes/${d.id}`}
                  className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 py-2 hover:bg-[var(--color-soft)]"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm">
                      {d.ct ?? `Afstemning #${d.id}`}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {voteTopics[String(d.id)]?.slice(0, 3).join(", ") ?? ""}
                    </div>
                  </div>
                  <div className="text-xs tabular-nums">
                    <span className="text-[var(--color-muted)]">{a.fornavn ?? a.navn}: </span>
                    {VOTE_LABELS[d.tA]}{" "}
                    <span className="text-[var(--color-muted)]">/ </span>
                    <span className="text-[var(--color-muted)]">{b.fornavn ?? b.navn}: </span>
                    {VOTE_LABELS[d.tB]}
                  </div>
                  <div className="text-xs tabular-nums text-[var(--color-muted)]">
                    {d.d}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {disagreements.length > 50 && (
            <p className="mt-3 text-xs text-[var(--color-muted)]">
              Viser de seneste 50 af{" "}
              {disagreements.length.toLocaleString("da-DK")} uenigheder.
            </p>
          )}
        </section>
      )}
    </>
  );
}

function ProfileCard({
  member,
  party,
}: {
  member: Member;
  party: Party | undefined;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-5">
      <div className="flex gap-4">
        {member.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photo}
            alt={member.navn}
            className="h-24 w-20 shrink-0 rounded border border-[var(--color-line)] object-cover"
          />
        ) : (
          <div className="h-24 w-20 shrink-0 rounded border border-dashed border-[var(--color-line)] bg-[var(--color-soft)]" />
        )}
        <div className="min-w-0">
          <Link
            href={`/members/${member.id}`}
            className="text-lg font-semibold hover:underline"
          >
            {member.navn}
          </Link>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <PartyBadge party={party} size="sm" />
            <span>{party?.navn ?? member.partyShort}</span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[var(--color-muted)]">
            {member.sex && <DefRow term="Køn" def={member.sex} />}
            {member.born && <DefRow term="Født" def={member.born} />}
            {member.educationStatistic && (
              <DefRow term="Uddannelse" def={member.educationStatistic} />
            )}
            {member.constituency && (
              <DefRow term="Storkreds" def={member.constituency} />
            )}
            {member.fremmødePct != null && (
              <DefRow term="Fremmøde" def={`${member.fremmødePct}%`} />
            )}
            {member.afvigelsePct != null && (
              <DefRow term="Afvigelse" def={`${member.afvigelsePct}%`} />
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}

function DefRow({ term, def }: { term: string; def: string }) {
  return (
    <>
      <dt>{term}</dt>
      <dd className="text-[var(--color-ink)]">{def}</dd>
    </>
  );
}
