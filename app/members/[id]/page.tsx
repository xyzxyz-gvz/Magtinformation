import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getMember,
  getMemberAllies,
  getMemberProfile,
  getMemberVotes,
  getMembers,
  getParties,
} from "@/lib/data";
import { VOTE_LABELS } from "@/lib/types";

export async function generateStaticParams() {
  const members = await getMembers();
  return members
    .filter((m) => m.isCurrentMF)
    .map((m) => ({ id: String(m.id) }));
}

export default async function MemberDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) notFound();

  const [member, profile, allies, parties, memberVotes] = await Promise.all([
    getMember(id),
    getMemberProfile(id),
    getMemberAllies(id),
    getParties(),
    getMemberVotes(id),
  ]);

  if (!member) notFound();

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const party = partyByShort.get(member.partyShort);
  const cv = profile?.cv ?? {};

  return (
    <div className="space-y-10">
      <div>
        <Link href="/members" className="text-sm text-[var(--color-muted)]">
          ← Medlemmer
        </Link>
      </div>

      <header className="flex flex-col gap-6 sm:flex-row">
        {member.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={member.photo}
            alt={member.navn}
            className="h-32 w-24 shrink-0 rounded border border-[var(--color-line)] object-cover"
          />
        ) : (
          <div className="h-32 w-24 shrink-0 rounded border border-dashed border-[var(--color-line)] bg-[var(--color-soft)]" />
        )}
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {member.navn}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <PartyBadge party={party} size="sm" />
            <span>{party?.navn ?? member.partyShort}</span>
          </div>
          {member.constituency && (
            <div className="mt-1 text-sm text-[var(--color-muted)]">
              {member.constituency}
            </div>
          )}
          {member.profession && (
            <div className="mt-1 text-sm text-[var(--color-muted)]">
              {member.profession}
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Fremmøde"
          value={member.fremmødePct != null ? `${member.fremmødePct}%` : "—"}
        />
        <Stat
          label="Afvigelse"
          value={member.afvigelsePct != null ? `${member.afvigelsePct}%` : "—"}
          hint="fra eget parti"
        />
        <Stat
          label="Afstemninger"
          value={member.afstemningerTotal.toLocaleString("da-DK")}
        />
      </div>

      {(cv.born || cv.educations?.length || cv.occupations?.length) && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            CV
          </h2>
          <dl className="space-y-3">
            {cv.born && <Row term="Født" def={cv.born} />}
            {cv.educations && cv.educations.length > 0 && (
              <Row term="Uddannelse" def={cv.educations.join(" · ")} />
            )}
            {cv.occupations && cv.occupations.length > 0 && (
              <Row term="Erhverv" def={cv.occupations.join(" · ")} />
            )}
            {cv.ministers && cv.ministers.length > 0 && (
              <Row term="Ministerposter" def={cv.ministers.join(" · ")} />
            )}
            {cv.positionsOfTrust && cv.positionsOfTrust.length > 0 && (
              <Row term="Tillidshverv" def={cv.positionsOfTrust.join(" · ")} />
            )}
            {cv.website && <Row term="Web" def={<a href={cv.website} target="_blank" rel="noreferrer" className="underline">{cv.website}</a>} />}
          </dl>
        </section>
      )}

      {profile && profile.committees.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Udvalg
          </h2>
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {profile.committees.slice(0, 12).map((c) => (
              <li
                key={c.navn + c.startdato}
                className="flex items-baseline justify-between gap-6 py-2"
              >
                <div>
                  <span className="text-sm">{c.navn}</span>
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    {c.role}
                  </span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                  {c.isCurrent ? "nuværende" : "tidligere"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Stemmer mest med — uden for eget parti
        </h2>
        {allies.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Endnu ingen data. Kør pipeline med opdateret preprocess.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {allies.map((a) => {
              const allyParty = partyByShort.get(a.party);
              return (
                <li key={a.id}>
                  <Link
                    href={`/members/${a.id}`}
                    className="flex items-center justify-between gap-6 py-3 hover:bg-[var(--color-soft)]"
                  >
                    <div className="flex items-center gap-3">
                      <PartyBadge party={allyParty} size="sm" />
                      <span className="text-sm">{a.navn}</span>
                      <span className="text-xs text-[var(--color-muted)]">
                        {allyParty?.navn ?? a.party}
                      </span>
                    </div>
                    <div className="shrink-0 text-sm tabular-nums">
                      {(a.agreement * 100).toFixed(1)}%{" "}
                      <span className="text-xs text-[var(--color-muted)]">
                        af {a.shared.toLocaleString("da-DK")}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {memberVotes.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Seneste stemmer
          </h2>
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {memberVotes.slice(0, 20).map((mv) => (
              <li key={mv.id}>
                <Link
                  href={`/votes/${mv.id}`}
                  className="flex items-baseline justify-between gap-6 py-2 hover:bg-[var(--color-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {mv.ct ?? `Afstemning #${mv.id}`}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {VOTE_LABELS[mv.t] ?? "?"}
                      {mv.dev ? " · afveg fra parti" : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                    {mv.d}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded border border-[var(--color-line)] p-3">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="text-xs text-[var(--color-muted)]">{hint}</div>
      )}
    </div>
  );
}

function Row({ term, def }: { term: string; def: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-4 text-sm">
      <dt className="text-[var(--color-muted)]">{term}</dt>
      <dd>{def}</dd>
    </div>
  );
}
