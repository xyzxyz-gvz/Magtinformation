import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getGovernments,
  getMembers,
  getParties,
  getVotesList,
} from "@/lib/data";
import { formatDateRange } from "@/lib/governments";

export default async function HomePage() {
  const [governments, parties, votes, members] = await Promise.all([
    getGovernments(),
    getParties(),
    getVotesList(),
    getMembers(),
  ]);

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const recentVotes = votes.slice(0, 8);

  const totalVotes = votes.length;
  const passed = votes.reduce((n, v) => n + (v.vedtaget ? 1 : 0), 0);
  const passedPct = totalVotes ? Math.round((passed / totalVotes) * 100) : 0;
  const currentMFs = members.filter((m) => m.isCurrentMF).length;
  const allMembers = members.length;
  const dates = votes.map((v) => v.dato).filter(Boolean);
  const minDate = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : null;
  const maxDate = dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : null;

  const interim = governments.find((g) => !g.end);

  return (
    <div className="space-y-14">
      {interim && interim.start >= "2026-03-24" && (
        <Link
          href={`/governments/${interim.slug}`}
          className="block rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 hover:bg-amber-100"
        >
          <span className="font-medium">Folketingsvalg 24. marts 2026:</span>{" "}
          Mette Frederiksen II er trådt tilbage og fortsætter som
          forretningsregering. {interim.name} — sammensætningen er endnu ikke
          kendt.
        </Link>
      )}

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
          </a>{" "}
          og opdateres jævnligt.
        </p>
      </section>

      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Fact
            label="Afstemninger"
            value={totalVotes.toLocaleString("da-DK")}
            hint={
              minDate && maxDate
                ? `${minDate.slice(0, 4)}–${maxDate.slice(0, 4)}`
                : undefined
            }
          />
          <Fact
            label="Vedtaget"
            value={`${passedPct}%`}
            hint={`${passed.toLocaleString("da-DK")} af ${totalVotes.toLocaleString("da-DK")}`}
          />
          <Fact
            label="Nuværende MF'er"
            value={currentMFs.toLocaleString("da-DK")}
            hint={`af ${allMembers.toLocaleString("da-DK")} registrerede`}
          />
          <Fact
            label="Regeringer"
            value={String(governments.length)}
            hint="dækket i datasættet"
          />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <FactBox
          title="Afstemninger"
          body="Slå hver afstemning op og se hvad sagen handlede om, hvem der stemte for og imod, og hvordan partierne fordelte sig."
          cta={{ href: "/votes", label: "Bladr i afstemninger →" }}
        />
        <FactBox
          title="Medlemmer"
          body="Hver MF har en profil med fremmøde, afvigelse fra eget parti og en oversigt opdelt på regeringsperioder."
          cta={{ href: "/members", label: "Se medlemmer →" }}
        />
        <FactBox
          title="Analyser"
          body="Tætteste afstemninger, partikoalitioner, partiskiftere og direkte sammenligning af to MF'er."
          cta={{ href: "/analyse", label: "Åbn analyser →" }}
        />
      </section>

      <section
        id="clearing"
        className="rounded-lg border border-[var(--color-line)] bg-[var(--color-soft)] p-6"
      >
        <h2 className="text-lg font-semibold tracking-tight">
          Hvorfor står der så mange “Fravær”?
        </h2>
        <div className="mt-3 max-w-3xl space-y-3 text-sm leading-relaxed text-[var(--color-ink)]">
          <p>
            Et MF, der ikke er i salen, registreres som <em>fravær</em>. Det
            betyder ikke nødvendigvis at vedkommende er pjækket fra arbejde —
            de fleste fravær skyldes <strong>clearingsaftaler</strong>.
          </p>
          <p>
            En clearingsaftale er en uskreven aftale mellem to MF'er på hver
            side af salen: hvis den ene er forhindret i at møde op (f.eks. på
            udvalgsrejse, i barsel, til møde i en kommune), bliver vedkommende
            “cleared” af en kollega fra modsatte fløj, der frivilligt stemmer
            blank. På den måde flyttes magtbalancen ikke, selv om to medlemmer
            er fraværende. Det er sådan Folketinget i praksis kan fungere selv
            om alle 179 medlemmer sjældent er fysisk til stede.
          </p>
          <p className="text-[var(--color-muted)]">
            Det betyder at en høj fraværsprocent ikke automatisk er udtryk for
            sløseri — men det betyder også at man ikke entydigt kan læse
            holdningen ud af, at nogen ikke stemte. Når du ser fravær på et
            medlems profil, er det altså den rå tælling fra Folketingets
            stemmeprotokol — ikke nødvendigvis et udtryk for udeblivelse.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Regeringer
        </h2>
        <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {governments.map((g) => (
            <Link
              key={g.slug}
              href={`/governments/${g.slug}`}
              className="flex items-center justify-between gap-6 py-4 hover:bg-[var(--color-soft)]"
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

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Seneste afstemninger
          </h2>
          <Link href="/votes" className="text-sm text-[var(--color-muted)]">
            Se alle →
          </Link>
        </div>
        {recentVotes.length === 0 ? (
          <EmptyHint />
        ) : (
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {recentVotes.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/votes/${v.id}`}
                  className="flex items-baseline justify-between gap-6 py-4 hover:bg-[var(--color-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {v.caseTitel ?? v.konklusion ?? `Afstemning #${v.id}`}
                    </div>
                    <div className="mt-0.5 text-sm text-[var(--color-muted)]">
                      {v.type ?? "Afstemning"} ·{" "}
                      <span
                        className={
                          v.vedtaget ? "text-emerald-700" : "text-rose-700"
                        }
                      >
                        {v.vedtaget ? "Vedtaget" : "Forkastet"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-sm tabular-nums text-[var(--color-muted)]">
                    {v.dato}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Fact({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && (
        <div className="mt-0.5 text-xs text-[var(--color-muted)]">{hint}</div>
      )}
    </div>
  );
}

function FactBox({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col rounded-lg border border-[var(--color-line)] p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 grow text-sm text-[var(--color-muted)]">{body}</p>
      <Link
        href={cta.href}
        className="mt-4 text-sm text-[var(--color-ink)] underline underline-offset-2"
      >
        {cta.label}
      </Link>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="rounded border border-dashed border-[var(--color-line)] bg-[var(--color-soft)] p-6 text-sm text-[var(--color-muted)]">
      Ingen data endnu. Kør pipeline:
      <pre className="mt-3 overflow-x-auto rounded bg-white p-3 text-xs text-[var(--color-ink)]">
        python -m pipeline.fetch_all{"\n"}python -m pipeline.preprocess
      </pre>
    </div>
  );
}
