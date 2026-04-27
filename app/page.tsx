import {
  ArrowRight,
  BarChart3,
  Database,
  Search,
} from "lucide-react";
import Link from "next/link";
import { CaseTypeBadge } from "@/components/CaseTypeBadge";
import { MeetFolketinget } from "@/components/MeetFolketinget";
import { PartyBadge } from "@/components/PartyBadge";
import { Reveal } from "@/components/Reveal";
import { buttonVariants } from "@/components/ui/button";
import {
  getGovernments,
  getMembers,
  getParties,
  getVoteTopics,
  getVotesList,
} from "@/lib/data";
import { formatDateRange } from "@/lib/governments";
import { cn } from "@/lib/utils";
import type { Vote } from "@/lib/types";

const RECENT_LIMIT = 6;
const TIGHTEST_LIMIT = 5;
const TOPICS_LIMIT = 12;
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
    <div className="space-y-16">
      {/* HERO — tight, focused, no irrelevant featured card */}
      <section className="space-y-6 pt-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-white px-3 py-1 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>
            {totalVotes.toLocaleString("da-DK")} afstemninger ·{" "}
            {governments.length} regeringer · siden {minDate?.slice(0, 4)}
          </span>
        </div>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          Hvad skete der i Folketinget,{" "}
          <span className="text-[var(--color-muted)]">egentlig?</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
          Folketingets åbne data, samlet ét sted og gjort til at læse. Se
          hvad der blev stemt om, hvem der stemte hvad, og hvilke mønstre
          der gemmer sig på tværs af regeringer og partier.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/votes"
            className={cn(buttonVariants({ size: "lg" }))}
          >
            Bladr i afstemninger
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#sadan-virker-det"
            className={cn(buttonVariants({ size: "lg", variant: "secondary" }))}
          >
            Sådan virker det
          </Link>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Data fra{" "}
          <a
            href="https://oda.ft.dk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            oda.ft.dk
          </a>{" "}
          · uafhængigt projekt ·{" "}
          <Link
            href="/om"
            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            metode
          </Link>
        </p>
      </section>

      {/* KPI STRIP — clickable, modest size, in one panel */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-line)] sm:grid-cols-4">
        <BigStat
          href="/votes"
          value={totalVotes.toLocaleString("da-DK")}
          label="Afstemninger"
          sub={
            minDate && maxDate
              ? `${minDate.slice(0, 4)}–${maxDate.slice(0, 4)}`
              : undefined
          }
        />
        <BigStat
          href="/votes?outcome=passed"
          value={`${passedPct}%`}
          label="Vedtaget"
          sub={`${passed.toLocaleString("da-DK")} af ${totalVotes.toLocaleString("da-DK")}`}
        />
        <BigStat
          href="/members?status=current"
          value={currentMFs.toLocaleString("da-DK")}
          label="Nuværende MF'er"
          sub={`af ${allMembers.toLocaleString("da-DK")} registrerede`}
        />
        <BigStat
          href="/governments"
          value={String(governments.length)}
          label="Regeringer"
          sub="dækket i datasættet"
        />
      </section>

      {/* SÅDAN VIRKER DET */}
      <Reveal>
        <section id="sadan-virker-det">
          <SectionHeader
            eyebrow="Sådan virker det"
            title="Fra rådata til klare svar"
          />
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Step
              n={1}
              icon={<Database className="h-4 w-4" />}
              title="Vi henter rådata"
              body="Afstemninger, sager, MF‑CV'er og udvalgsroller fra Folketingets åbne API."
            />
            <Step
              n={2}
              icon={<BarChart3 className="h-4 w-4" />}
              title="Vi beregner mønstre"
              body="Fremmøde, afvigelse, agreement, demografi pr. regering — alt udledt fra rådataet."
            />
            <Step
              n={3}
              icon={<Search className="h-4 w-4" />}
              title="Du udforsker"
              body="Filtrér og sammenlign på MF, parti, regering, emne eller sagstype."
            />
          </div>
        </section>
      </Reveal>

      {/* MØD FOLKETINGET */}
      <Reveal>
        <SectionHeader
          eyebrow="Folketinget"
          title="Mød din politiker"
          link={{ href: "/members", label: "Bladr alle MF'er →" }}
        />
        <div className="mt-6">
          <MeetFolketinget members={meetMembers} parties={parties} />
        </div>
      </Reveal>

      {/* SENESTE + TÆTTESTE */}
      <Reveal>
        <SectionHeader
          eyebrow="Aktivitet"
          title="Friske afstemninger og dramaet bag"
        />
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <VoteList
            heading="Seneste afstemninger"
            link={{ href: "/votes", label: "Se alle" }}
            votes={recentVotes}
            kind="recent"
          />
          <VoteList
            heading="Mest tilspidsede"
            link={{ href: "/analyse/afstemninger", label: "Se top 25" }}
            votes={tightestVotes}
            kind="drama"
          />
        </div>
      </Reveal>

      {/* AKTUELLE EMNER */}
      {recentTopics.length > 0 && (
        <Reveal>
          <SectionHeader
            eyebrow="Aktuelt"
            title="Hvad er der diskuteret?"
            link={{ href: "/topics", label: "Alle emner →" }}
          />
          <p className="mt-3 max-w-2xl text-sm text-[var(--color-muted)]">
            Mest omtalte emneord blandt de seneste {TOPICS_FROM_RECENT}{" "}
            afstemninger.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {recentTopics.map((t) => (
              <Link
                key={t.topic}
                href={`/topics/${encodeURIComponent(t.topic)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm no-underline transition hover:border-[var(--color-ink)] hover:bg-[var(--color-soft)] hover:no-underline"
              >
                <span>{t.topic}</span>
                <span className="text-xs tabular-nums text-[var(--color-muted)]">
                  {t.count}
                </span>
              </Link>
            ))}
          </div>
        </Reveal>
      )}

      {/* ANALYSEVÆRKTØJER */}
      <Reveal>
        <SectionHeader
          eyebrow="Værktøjer"
          title="Find mønstre, ikke bare tal"
          link={{ href: "/analyse", label: "Alle analyser →" }}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ToolCard
            href="/analyse/koalitioner"
            title="Koalitioner mellem partier"
            body="Matrix over hvor ofte hvert par stemte ens — afslører reelle samarbejdsflader."
          />
          <ToolCard
            href="/analyse/afstemninger"
            title="Tætteste afstemninger"
            body="Top 25 over de mest tilspidsede afstemninger — få stemmer fra at vippe."
          />
          <ToolCard
            href="/partiskiftere"
            title="Partiskiftere"
            body="MF'er der har siddet for mere end én folketingsgruppe — komplet tidslinje."
          />
          <ToolCard
            href="/members/sammenlign"
            title="Sammenlign to MF'er"
            body="Stil to medlemmer side om side: enighed, demografi og uenigheder."
          />
          <ToolCard
            href="/parties/sammenlign"
            title="Sammenlign to partier"
            body="Hvor enige er partiernes flertal? Find emnerne der deler dem, og afstemningerne de stemte forskelligt om."
          />
          <ToolCard
            href="/topics"
            title="Emneord"
            body="Dyk ned i et specifikt emne — alle afstemninger og partiernes flertal."
          />
          <ToolCard
            href="/governments"
            title="Regeringer"
            body="Sammensætning, demografi og afstemningsaktivitet pr. regeringsperiode."
          />
        </div>
      </Reveal>

      {/* REGERINGER PREVIEW */}
      <Reveal>
        <SectionHeader
          eyebrow="Regeringer"
          title="Magten siden 2014"
          link={{
            href: "/governments",
            label: `Se alle ${governments.length} →`,
          }}
        />
        <div className="mt-6 divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {govPreview.map((g) => (
            <Link
              key={g.slug}
              href={`/governments/${g.slug}`}
              className="flex items-center justify-between gap-6 py-4 hover:bg-[var(--color-soft)]"
            >
              <div className="min-w-0">
                <div className="font-medium">{g.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-muted)]">
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
      </Reveal>

      {/* CLEARING NOTE */}
      <Reveal>
        <section
          id="clearing"
          className="rounded-xl border border-[var(--color-line)] bg-[var(--color-soft)] p-6 text-sm leading-relaxed"
        >
          <h2 className="font-semibold">
            Hvorfor står der så mange "Fravær"?
          </h2>
          <p className="mt-2 max-w-3xl text-[var(--color-ink)]">
            Mange fravær skyldes <strong>clearingsaftaler</strong> — to MF'er
            fra hver sin fløj aftaler at stemme blank, så magtbalancen ikke
            flyttes når den ene er forhindret. Et højt fraværstal er altså
            ikke automatisk udtryk for sløseri.{" "}
            <Link
              href="/om#metode"
              className="underline underline-offset-2 hover:text-[var(--color-ink)]"
            >
              Læs hvordan vi opgør tallene
            </Link>
            .
          </p>
        </section>
      </Reveal>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  link,
}: {
  eyebrow: string;
  title: string;
  link?: { href: string; label: string };
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {eyebrow}
        </div>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">
          {title}
        </h2>
      </div>
      {link && (
        <Link
          href={link.href}
          className="text-xs text-[var(--color-muted)] underline-offset-2 hover:text-[var(--color-ink)] hover:underline"
        >
          {link.label}
        </Link>
      )}
    </header>
  );
}

function Step({
  n,
  icon,
  title,
  body,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-5 transition hover:border-[var(--color-ink)]/30">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-soft)] text-[var(--color-ink)]">
          {icon}
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)]">
          {n}. trin
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
        {body}
      </p>
    </div>
  );
}

function BigStat({
  href,
  value,
  label,
  sub,
}: {
  href: string;
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-white p-5 no-underline transition hover:bg-[var(--color-soft)] hover:no-underline"
    >
      <div className="text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </div>
      <div className="mt-1.5 text-xs font-medium">{label}</div>
      {sub && (
        <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{sub}</div>
      )}
    </Link>
  );
}

type Tightest = Vote & { decided: number; margin: number; marginPct: number };

function VoteList({
  heading,
  link,
  votes,
  kind,
}: {
  heading: string;
  link?: { href: string; label: string };
  votes: (Vote | Tightest)[];
  kind: "recent" | "drama";
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {heading}
        </h3>
        {link && (
          <Link
            href={link.href}
            className="text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            {link.label} →
          </Link>
        )}
      </div>
      <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
        {votes.map((v) => {
          const t = v as Tightest;
          return (
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
                      {" "}· {v.forCount} for / {v.imodCount} imod
                      {kind === "drama" && t.margin !== undefined && (
                        <>
                          {" "}·{" "}
                          <span className="font-medium text-[var(--color-ink)]">
                            {t.margin === 0
                              ? "uafgjort"
                              : `${t.margin} stemmes forskel`}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                  {v.dato}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
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
      className="group flex h-full flex-col rounded-xl border border-[var(--color-line)] bg-white p-5 no-underline transition hover:-translate-y-0.5 hover:border-[var(--color-ink)]/30 hover:shadow-sm hover:no-underline"
    >
      <h3 className="text-sm font-semibold tracking-tight text-[var(--color-ink)]">
        {title}
      </h3>
      <p className="mt-1.5 grow text-xs leading-relaxed text-[var(--color-muted)]">
        {body}
      </p>
      <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-ink)]">
        Åbn{" "}
        <ArrowRight className="h-3 w-3 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function computeTightest(votes: Vote[], n: number): Tightest[] {
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
