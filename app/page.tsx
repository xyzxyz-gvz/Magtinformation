import Link from "next/link";
import { CaseTypeBadge } from "@/components/CaseTypeBadge";
import { MeetFolketinget } from "@/components/MeetFolketinget";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getGovernments,
  getMembers,
  getParties,
  getVoteTopics,
  getVotesList,
} from "@/lib/data";
import { formatDateRange } from "@/lib/governments";
import type { Vote } from "@/lib/types";

const RECENT_LIMIT = 7;
const TIGHTEST_LIMIT = 5;
const TOPICS_LIMIT = 10;
const TOPICS_FROM_RECENT = 300;
const TIGHTEST_MIN_DECIDED = 80;

export default async function HomePage() {
  const [governments, parties, votes, members, voteTopics] = await Promise.all([
    getGovernments(),
    getParties(),
    getVotesList(),
    getMembers(),
    getVoteTopics(),
  ]);

  const partyByShort = new Map(parties.map((p) => [p.short, p]));

  const totalVotes = votes.length;
  const passed = votes.reduce((n, v) => n + (v.vedtaget ? 1 : 0), 0);
  const passedPct = totalVotes ? Math.round((passed / totalVotes) * 100) : 0;
  const currentMFsList = members.filter((m) => m.isCurrentMF);
  const currentMFs = currentMFsList.length;
  const allMembers = members.length;
  const dates = votes.map((v) => v.dato).filter(Boolean);
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  const recentVotes = votes.slice(0, RECENT_LIMIT);

  const tightestVotes = computeTightest(votes, TIGHTEST_LIMIT);

  const recentTopics = countRecentTopics(votes, voteTopics, TOPICS_FROM_RECENT)
    .slice(0, TOPICS_LIMIT);

  const meetMembers = currentMFsList.map((m) => ({
    id: m.id,
    navn: m.navn,
    fornavn: m.fornavn,
    efternavn: m.efternavn,
    partyShort: m.partyShort,
    photo: m.photo,
  }));

  const sortedGovs = [...governments].sort((a, b) =>
    b.start.localeCompare(a.start),
  );
  const govPreview = sortedGovs.slice(0, 3);

  return (
    <div className="space-y-12">
      <section>
        <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
          Magtinformation
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          Hvem stemte hvad i Folketinget?
        </h1>
        <p className="mt-4 max-w-2xl text-[var(--color-muted)]">
          Magtinformation samler Folketingets åbne afstemningsdata ét sted, så
          enhver kan se præcis hvad der blev stemt om, hvordan det enkelte
          medlem stemte, og hvordan billedet ser ud på tværs af regeringer og
          partier. Data kommer fra{" "}
          <a
            href="https://oda.ft.dk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            oda.ft.dk
          </a>
          .{" "}
          <Link href="/om" className="underline underline-offset-2 hover:text-[var(--color-ink)]">
            Sådan beregner vi tallene →
          </Link>
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FactLink
          href="/votes"
          label="Afstemninger"
          value={totalVotes.toLocaleString("da-DK")}
          hint={
            minDate && maxDate
              ? `${minDate.slice(0, 4)}–${maxDate.slice(0, 4)}`
              : undefined
          }
        />
        <FactLink
          href="/votes?outcome=passed"
          label="Vedtaget"
          value={`${passedPct}%`}
          hint={`${passed.toLocaleString("da-DK")} af ${totalVotes.toLocaleString("da-DK")}`}
        />
        <FactLink
          href="/members?status=current"
          label="Nuværende MF'er"
          value={currentMFs.toLocaleString("da-DK")}
          hint={`af ${allMembers.toLocaleString("da-DK")} registrerede`}
        />
        <FactLink
          href="/governments"
          label="Regeringer"
          value={String(governments.length)}
          hint="dækket i datasættet"
        />
      </section>

      <MeetFolketinget members={meetMembers} parties={parties} />

      <section className="grid gap-8 lg:grid-cols-2">
        <Column
          title="Seneste afstemninger"
          link={{ href: "/votes", label: "Se alle" }}
        >
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {recentVotes.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/votes/${v.id}`}
                  className="flex items-baseline justify-between gap-4 py-3 hover:bg-[var(--color-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <CaseTypeBadge
                        caseNummer={v.caseNummer}
                        caseTitel={v.caseTitel}
                      />
                      <span className="truncate text-sm">
                        {v.caseTitel ?? v.konklusion ?? `Afstemning #${v.id}`}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs">
                      <span
                        className={
                          v.vedtaget ? "text-emerald-700" : "text-rose-700"
                        }
                      >
                        {v.vedtaget ? "Vedtaget" : "Forkastet"}
                      </span>
                      <span className="text-[var(--color-muted)]">
                        {" "}
                        · {v.forCount} for / {v.imodCount} imod
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                    {v.dato}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Column>

        <Column
          title="Mest tilspidsede afstemninger"
          subtitle="Vedtaget eller forkastet med snæver margen — få stemmer fra at vippe."
          link={{ href: "/analyse/afstemninger", label: "Se top 25" }}
        >
          {tightestVotes.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">
              Ingen data endnu.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
              {tightestVotes.map((v) => (
                <li key={v.id}>
                  <Link
                    href={`/votes/${v.id}`}
                    className="flex items-baseline justify-between gap-4 py-3 hover:bg-[var(--color-soft)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">
                        {v.caseTitel ?? v.konklusion ?? `Afstemning #${v.id}`}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                        <span
                          className={
                            v.vedtaget ? "text-emerald-700" : "text-rose-700"
                          }
                        >
                          {v.vedtaget ? "Vedtaget" : "Forkastet"}
                        </span>{" "}
                        · {v.forCount} for / {v.imodCount} imod ·{" "}
                        {v.margin === 0
                          ? "uafgjort"
                          : `${v.margin} stemmes forskel`}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                      {v.dato}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Column>
      </section>

      {recentTopics.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
              Aktuelle emner
            </h2>
            <Link
              href="/topics"
              className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
            >
              Alle emner →
            </Link>
          </div>
          <p className="mb-3 max-w-2xl text-xs text-[var(--color-muted)]">
            Mest omtalte emneord blandt de seneste {TOPICS_FROM_RECENT}{" "}
            afstemninger. Klik for at se alle relaterede sager og partiernes
            stemmemønstre.
          </p>
          <div className="flex flex-wrap gap-2">
            {recentTopics.map((t) => (
              <Link
                key={t.topic}
                href={`/topics/${encodeURIComponent(t.topic)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] px-3 py-1 text-sm no-underline hover:bg-[var(--color-soft)] hover:no-underline"
              >
                <span>{t.topic}</span>
                <span className="text-xs tabular-nums text-[var(--color-muted)]">
                  {t.count}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Analyseværktøjer
          </h2>
          <Link
            href="/analyse"
            className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            Alle analyser →
          </Link>
        </div>
        <p className="mb-4 max-w-2xl text-xs text-[var(--color-muted)]">
          Mønstre på tværs af afstemninger, partier og MF'er — bygget på det
          samme datasæt.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            href="/analyse/koalitioner"
            title="Koalitioner mellem partier"
            body="Matrix over hvor ofte hvert par af partier stemte ens — afslører reelle samarbejdsflader bag de officielle blokke."
          />
          <ToolCard
            href="/analyse/afstemninger"
            title="Tætteste afstemninger"
            body="Top 25 over de mest tilspidsede afstemninger — dem hvor en håndfuld stemmer kunne have vendt resultatet."
          />
          <ToolCard
            href="/partiskiftere"
            title="Partiskiftere"
            body="MF'er der har siddet for mere end én folketingsgruppe — komplet tidslinje pr. person."
          />
          <ToolCard
            href="/members/sammenlign"
            title="Sammenlign to MF'er"
            body="Stil to medlemmer side om side: enighed, demografi og en liste over de afstemninger de stemte forskelligt om."
          />
          <ToolCard
            href="/topics"
            title="Emneord"
            body="Dyk ned i et specifikt emne — alle relaterede afstemninger og partiernes flertal hen over tid."
          />
          <ToolCard
            href="/governments"
            title="Regeringer"
            body="Sammensætning, demografi og afstemningsaktivitet for hver regeringsperiode i datasættet."
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Regeringer
          </h2>
          <Link
            href="/governments"
            className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            Se alle {governments.length} →
          </Link>
        </div>
        <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {govPreview.map((g) => (
            <Link
              key={g.slug}
              href={`/governments/${g.slug}`}
              className="flex items-center justify-between gap-6 py-3 hover:bg-[var(--color-soft)]"
            >
              <div className="min-w-0">
                <div className="font-medium">{g.name}</div>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
                  {g.parties.map((short) => (
                    <PartyBadge
                      key={short}
                      party={partyByShort.get(short)}
                      size="sm"
                    />
                  ))}
                  <span className="ml-1">{g.type.toLowerCase()}</span>
                </div>
              </div>
              <div className="shrink-0 text-sm tabular-nums text-[var(--color-muted)]">
                {formatDateRange(g)}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        id="clearing"
        className="rounded-lg border border-[var(--color-line)] bg-[var(--color-soft)] p-5 text-sm leading-relaxed"
      >
        <h2 className="font-semibold">Hvorfor står der så mange "Fravær"?</h2>
        <p className="mt-2 text-[var(--color-ink)]">
          Mange fravær skyldes <strong>clearingsaftaler</strong> — to MF'er
          fra hver sin fløj aftaler at stemme blank, så magtbalancen ikke
          flyttes når den ene er forhindret (orlov, udvalgsrejser m.m.). Et
          højt fraværstal er altså ikke automatisk udtryk for sløseri.{" "}
          <Link
            href="/om#metode"
            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Læs hvordan vi opgør tallene
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

type TightestVote = Vote & { decided: number; margin: number; marginPct: number };

function computeTightest(votes: Vote[], n: number): TightestVote[] {
  const enriched = votes
    .map((v) => {
      const decided = v.forCount + v.imodCount;
      const margin = Math.abs(v.forCount - v.imodCount);
      return {
        ...v,
        decided,
        margin,
        marginPct: decided > 0 ? margin / decided : 1,
      };
    })
    .filter((v) => v.decided >= TIGHTEST_MIN_DECIDED);
  enriched.sort(
    (a, b) =>
      a.marginPct - b.marginPct ||
      a.margin - b.margin ||
      b.dato.localeCompare(a.dato),
  );
  return enriched.slice(0, n);
}

function countRecentTopics(
  votes: Vote[],
  voteTopics: Record<string, string[]>,
  recentN: number,
): { topic: string; count: number }[] {
  const counts = new Map<string, number>();
  const slice = votes.slice(0, recentN);
  for (const v of slice) {
    const ts = voteTopics[String(v.id)];
    if (!ts) continue;
    for (const t of ts) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, "da"));
}

function ToolCard({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-lg border border-[var(--color-line)] p-4 no-underline transition hover:bg-[var(--color-soft)] hover:no-underline"
    >
      <h3 className="text-sm font-semibold text-[var(--color-ink)]">{title}</h3>
      <p className="mt-1.5 grow text-xs leading-relaxed text-[var(--color-muted)]">
        {body}
      </p>
      <span className="mt-3 text-xs text-[var(--color-ink)] underline-offset-2 group-hover:underline">
        Åbn →
      </span>
    </Link>
  );
}

function FactLink({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-[var(--color-line)] p-4 no-underline hover:bg-[var(--color-soft)] hover:no-underline"
    >
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</div>
      )}
    </Link>
  );
}

function Column({
  title,
  subtitle,
  link,
  children,
}: {
  title: string;
  subtitle?: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {title}
        </h2>
        {link && (
          <Link
            href={link.href}
            className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            {link.label} →
          </Link>
        )}
      </div>
      {subtitle && (
        <p className="mb-3 text-xs text-[var(--color-muted)]">{subtitle}</p>
      )}
      {children}
    </div>
  );
}
