import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProfileTabs, type TabSpec } from "@/components/ProfileTabs";
import {
  MemberAttendanceChart,
  type AttendancePoint,
} from "@/components/charts/MemberAttendanceChart";
import {
  MemberVotesExplorer,
  type ExplorerVote,
} from "@/components/MemberVotesExplorer";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getGovernments,
  getMember,
  getMemberAllies,
  getMemberPartyHistory,
  getMemberProfile,
  getMemberVotes,
  getMembers,
  getParties,
  getVoteTopics,
} from "@/lib/data";
import {
  bucketMemberVotesByGovernment,
  formatDateRange,
  type GovernmentBucket,
} from "@/lib/governments";
import type {
  Ally,
  CV,
  Member,
  MemberPartyHistory,
  Party,
} from "@/lib/types";

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

  const [
    member,
    profile,
    allies,
    parties,
    memberVotes,
    governments,
    voteTopics,
    partyHistoryMap,
  ] = await Promise.all([
    getMember(id),
    getMemberProfile(id),
    getMemberAllies(id),
    getParties(),
    getMemberVotes(id),
    getGovernments(),
    getVoteTopics(),
    getMemberPartyHistory(),
  ]);

  if (!member) notFound();

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const party = partyByShort.get(member.partyShort);
  const cv = profile?.cv ?? {};
  const partyHistory = partyHistoryMap[String(id)] ?? null;

  const govBuckets = bucketMemberVotesByGovernment(memberVotes, governments);
  const totalBucket = govBuckets.reduce(
    (acc, b) => {
      acc.total += b.total;
      acc.present += b.present;
      acc.absent += b.absent;
      acc.deviation += b.deviation;
      return acc;
    },
    { total: 0, present: 0, absent: 0, deviation: 0 },
  );
  const totalFremmøde = totalBucket.total
    ? Math.round((totalBucket.present / totalBucket.total) * 100)
    : null;
  const totalAfvigelse = totalBucket.present
    ? Math.round((totalBucket.deviation / totalBucket.present) * 100)
    : null;

  // Attendance over time — quarterly buckets so trends emerge without noise.
  // We aggregate present/absent per quarter, then pct = present / total.
  const attendanceMap = new Map<string, { present: number; total: number }>();
  for (const mv of memberVotes) {
    if (!mv.d) continue;
    const [year, mo] = mv.d.split("-");
    const q = Math.ceil(Number(mo) / 3);
    const bucket = `${year}-Q${q}`;
    const row = attendanceMap.get(bucket) ?? { present: 0, total: 0 };
    row.total++;
    if (mv.t !== 3) row.present++;
    attendanceMap.set(bucket, row);
  }
  const attendanceTrend: AttendancePoint[] = [...attendanceMap.entries()]
    .filter(([, r]) => r.total >= 5) // skip near-empty quarters
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, r]) => ({
      bucket,
      label: bucket.replace("-", " "),
      pct: Math.round((r.present / r.total) * 100),
      total: r.total,
    }));

  const explorerVotes: ExplorerVote[] = memberVotes.map((mv) => ({
    id: mv.id,
    d: mv.d,
    t: mv.t,
    v: mv.v,
    ct: mv.ct,
    cn: mv.cn,
    dev: mv.dev,
    topics: voteTopics[String(mv.id)] ?? [],
  }));
  const totalDeviation = explorerVotes.reduce((n, v) => n + (v.dev ? 1 : 0), 0);

  const topicCountMap = new Map<string, number>();
  for (const v of explorerVotes) {
    for (const t of v.topics) {
      topicCountMap.set(t, (topicCountMap.get(t) ?? 0) + 1);
    }
  }
  const topicCounts = [...topicCountMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"))
    .map(([topic, count]) => ({ topic, count }));

  const dateValues = explorerVotes.map((v) => v.d);
  const minDate = dateValues.length
    ? dateValues.reduce((a, b) => (a < b ? a : b))
    : "";
  const maxDate = dateValues.length
    ? dateValues.reduce((a, b) => (a > b ? a : b))
    : "";

  const hasCV =
    !!(
      cv.born ||
      cv.educations?.length ||
      cv.occupations?.length ||
      cv.ministers?.length ||
      cv.positionsOfTrust?.length ||
      cv.website
    );
  const committeeCount = profile?.committees.length ?? 0;

  // Pull short minister titles. Folketinget formats them in a few variants:
  //   "Forsvarsminister, 9. august 2013 – 28. juni 2015."
  //   "Finansminister fra 27. juni 2019."
  //   "Klimaminister 2018-2019."
  // We strip from the first comma OR " fra ", OR from the first digit, then
  // trim a trailing period.
  const cleanTitle = (line: string): string => {
    const cut = line.split(/,| fra | \d/)[0];
    return cut.trim().replace(/\.$/, "");
  };
  const uniqueMinisterTitles = Array.from(
    new Set((cv.ministers ?? []).map(cleanTitle).filter(Boolean)),
  );

  const bornISO = parseDanishDate(cv.born ?? null);
  const bornFormatted = bornISO
    ? new Date(bornISO).toLocaleDateString("da-DK", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : cv.born ?? null;
  const age = bornISO
    ? computeAge(bornISO, new Date().toISOString().slice(0, 10))
    : null;

  const tabs: TabSpec[] = [
    { id: "oversigt", label: "Oversigt" },
    { id: "stemmer", label: "Stemmer", count: explorerVotes.length || null },
    ...(committeeCount > 0
      ? [{ id: "udvalg", label: "Udvalg", count: committeeCount } as TabSpec]
      : []),
  ];

  return (
    <div className="space-y-8">
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
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {member.navn}
          </h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <PartyBadge party={party} size="sm" />
            <span>{party?.navn ?? member.partyShort}</span>
            {!member.isCurrentMF && (
              <span className="text-xs text-[var(--color-muted)]">tidl. MF</span>
            )}
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--color-muted)]">
            {bornFormatted && (
              <Meta
                term="Født"
                def={
                  <>
                    {bornFormatted}
                    {age != null && (
                      <span className="text-[var(--color-muted)]">
                        {" "}
                        · {age} år
                      </span>
                    )}
                  </>
                }
              />
            )}
            {member.constituency && (
              <Meta term="Storkreds" def={member.constituency} />
            )}
            {member.profession && (
              <Meta term="Erhverv" def={member.profession} />
            )}
          </dl>
          {uniqueMinisterTitles.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-muted)]">
                Ministerposter
              </div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueMinisterTitles.map((title) => (
                  <span
                    key={title}
                    className="inline-block rounded-full bg-[var(--color-soft)] px-2.5 py-0.5 text-xs"
                  >
                    {title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <ProfileTabs
        tabs={tabs}
        defaultTab="oversigt"
        panels={[
          {
            id: "oversigt",
            node: (
              <div className="space-y-10">
                {partyHistory?.switched && (
                  <PartihistorikSection
                    member={member}
                    history={partyHistory}
                    partyByShort={partyByShort}
                  />
                )}
                {govBuckets.length > 0 && (
                  <PerGovernmentSection
                    member={member}
                    govBuckets={govBuckets}
                    totalBucket={totalBucket}
                    totalFremmøde={totalFremmøde}
                    totalAfvigelse={totalAfvigelse}
                  />
                )}
                {attendanceTrend.length >= 4 && (
                  <section>
                    <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
                      Fremmøde over tid
                    </h2>
                    <p className="mb-3 max-w-2xl text-xs text-[var(--color-muted)]">
                      Andelen af afstemninger {member.fornavn ?? member.navn}{" "}
                      har deltaget i (alt undtagen fravær), opdelt pr. kvartal.
                      Hver prik er ét kvartal med mindst 5 afstemninger.
                    </p>
                    <MemberAttendanceChart
                      data={attendanceTrend}
                      averagePct={totalFremmøde}
                    />
                  </section>
                )}
                {hasCV && (
                  <section>
                    <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
                      CV
                    </h2>
                    <CvSection cv={cv} />
                  </section>
                )}
                <AlliesSection allies={allies} partyByShort={partyByShort} />
              </div>
            ),
          },
          {
            id: "stemmer",
            node:
              explorerVotes.length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">
                  Ingen stemmedata for denne MF.
                </p>
              ) : (
                <section>
                  <p className="mb-4 max-w-2xl text-xs text-[var(--color-muted)]">
                    Søg, filtrer på dato, emne eller stemmetype, og slå "Kun
                    afvigelser" til for kun at se de afstemninger hvor{" "}
                    {member.fornavn ?? member.navn} stemte anderledes end
                    flertallet i {party?.navn ?? member.partyShort}.
                  </p>
                  <Suspense fallback={null}>
                    <MemberVotesExplorer
                      votes={explorerVotes}
                      topicCounts={topicCounts}
                      minDate={minDate}
                      maxDate={maxDate}
                      totalDeviation={totalDeviation}
                    />
                  </Suspense>
                </section>
              ),
          },
          ...(committeeCount > 0
            ? [
                {
                  id: "udvalg",
                  node: (
                    <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
                      {profile!.committees.slice(0, 30).map((c) => (
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
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function PartihistorikSection({
  member,
  history,
  partyByShort,
}: {
  member: Member;
  history: MemberPartyHistory;
  partyByShort: Map<string, Party>;
}) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Partihistorik
        </h2>
        <Link
          href="/partiskiftere"
          className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
        >
          Andre partiskiftere →
        </Link>
      </div>
      <p className="mb-3 max-w-2xl text-xs text-[var(--color-muted)]">
        {member.fornavn ?? member.navn} har siddet for{" "}
        {history.distinctParties.length} forskellige grupper. Dato‑perioder
        kommer direkte fra Folketingets aktørrelationer.
      </p>
      <ol className="relative space-y-2 border-l border-[var(--color-line)] pl-4">
        {[...history.timeline].reverse().map((t, i) => {
          const p = partyByShort.get(t.partyShort);
          const range = `${t.start ?? "—"} – ${t.end ?? "nu"}`;
          return (
            <li key={`${t.partyShort}-${t.start ?? i}`} className="relative">
              <span
                className="absolute -left-[21px] top-1.5 h-3 w-3 rounded-full border-2 border-white"
                style={{ background: p?.color ?? "#888" }}
              />
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <PartyBadge party={p} size="sm" />
                <span className="font-medium">{p?.navn ?? t.partyName}</span>
                <span className="text-xs tabular-nums text-[var(--color-muted)]">
                  {range}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function PerGovernmentSection({
  member,
  govBuckets,
  totalBucket,
  totalFremmøde,
  totalAfvigelse,
}: {
  member: Member;
  govBuckets: GovernmentBucket[];
  totalBucket: { total: number; present: number; absent: number; deviation: number };
  totalFremmøde: number | null;
  totalAfvigelse: number | null;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
        Pr. regering
      </h2>
      <p className="mb-3 max-w-2xl text-xs text-[var(--color-muted)]">
        Fremmøde og afvigelse opdelt på de regeringer{" "}
        {member.fornavn ?? member.navn} har siddet under. "Fravær" kan
        skyldes lovlig{" "}
        <Link href="/#clearing" className="underline underline-offset-2">
          clearingsaftale
        </Link>{" "}
        — det er altså ikke nødvendigvis udeblivelse.
      </p>
      <div className="overflow-x-auto rounded border border-[var(--color-line)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wider text-[var(--color-muted)]">
              <th className="px-3 py-2 font-medium">Regering</th>
              <th className="px-3 py-2 text-right font-medium">Afstemninger</th>
              <th className="px-3 py-2 text-right font-medium">Stemte</th>
              <th className="px-3 py-2 text-right font-medium">Fravær</th>
              <th className="px-3 py-2 text-right font-medium">Fremmøde</th>
              <th className="px-3 py-2 text-right font-medium">Afvigelse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-line)]">
            {govBuckets.map((b, i) => (
              <tr key={b.government?.slug ?? `none-${i}`}>
                <td className="px-3 py-2">
                  {b.government ? (
                    <Link
                      href={`/governments/${b.government.slug}`}
                      className="hover:underline"
                    >
                      {b.government.name}
                    </Link>
                  ) : (
                    <span className="text-[var(--color-muted)]">
                      Uden for regeringsperiode
                    </span>
                  )}
                  <div className="text-xs text-[var(--color-muted)]">
                    {b.government ? formatDateRange(b.government) : "—"}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.total.toLocaleString("da-DK")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.present.toLocaleString("da-DK")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.absent.toLocaleString("da-DK")}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.fremmødePct != null ? `${b.fremmødePct}%` : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {b.afvigelsePct != null ? `${b.afvigelsePct}%` : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-[var(--color-soft)] font-medium">
              <td className="px-3 py-2">Samlet</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totalBucket.total.toLocaleString("da-DK")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totalBucket.present.toLocaleString("da-DK")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totalBucket.absent.toLocaleString("da-DK")}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totalFremmøde != null ? `${totalFremmøde}%` : "—"}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {totalAfvigelse != null ? `${totalAfvigelse}%` : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlliesSection({
  allies,
  partyByShort,
}: {
  allies: Ally[];
  partyByShort: Map<string, Party>;
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
        Stemmer mest med — uden for eget parti
      </h2>
      {allies.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Endnu ingen data.
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
  );
}

function CvSection({ cv }: { cv: CV }) {
  return (
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
      {cv.website && (
        <Row
          term="Web"
          def={
            <a
              href={cv.website}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {cv.website}
            </a>
          }
        />
      )}
    </dl>
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

function Meta({ term, def }: { term: string; def: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {term}
      </dt>
      <dd className="text-[var(--color-ink)]">{def}</dd>
    </div>
  );
}

function parseDanishDate(d: string | null): string | null {
  if (!d) return null;
  // Folketinget's CV typically uses "DD-MM-YYYY"
  const m = d.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return null;
  const [, day, mon, year] = m;
  return `${year}-${mon.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function computeAge(bornISO: string, refISO: string): number | null {
  const b = new Date(bornISO);
  const r = new Date(refISO);
  if (isNaN(b.getTime()) || isNaN(r.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const dm = r.getMonth() - b.getMonth();
  if (dm < 0 || (dm === 0 && r.getDate() < b.getDate())) age--;
  return age;
}
