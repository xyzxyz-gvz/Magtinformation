import Link from "next/link";
import { getGovernments, getVotesList } from "@/lib/data";
import { getGovernmentForDate } from "@/lib/governments";
import type { Vote } from "@/lib/types";

export const metadata = {
  title: "Tætteste og mest enige afstemninger — Magtinformation",
};

const MIN_DECIDED = 80; // ignore tiny near-empty votes (only N voted)

type Row = Vote & { decided: number; margin: number; marginPct: number };

export default async function MostDivided({
  searchParams,
}: {
  searchParams: Promise<{ gov?: string }>;
}) {
  const sp = await searchParams;
  const govSlug = sp.gov ?? "";

  const [votes, governments] = await Promise.all([
    getVotesList(),
    getGovernments(),
  ]);
  const gov = governments.find((g) => g.slug === govSlug) ?? null;

  let scoped = votes;
  if (gov) {
    scoped = scoped.filter(
      (v) => v.dato >= gov.start && (gov.end === null || v.dato < gov.end),
    );
  }

  const enriched: Row[] = scoped
    .map((v) => {
      const decided = v.forCount + v.imodCount;
      const margin = Math.abs(v.forCount - v.imodCount);
      const marginPct = decided > 0 ? margin / decided : 1;
      return { ...v, decided, margin, marginPct };
    })
    .filter((v) => v.decided >= MIN_DECIDED);

  const tightest = [...enriched]
    .sort(
      (a, b) =>
        a.marginPct - b.marginPct ||
        a.margin - b.margin ||
        b.dato.localeCompare(a.dato),
    )
    .slice(0, 25);

  const mostUnited = [...enriched]
    .sort(
      (a, b) =>
        b.marginPct - a.marginPct ||
        b.decided - a.decided ||
        b.dato.localeCompare(a.dato),
    )
    .slice(0, 25);

  return (
    <div className="space-y-10">
      <div>
        <Link href="/" className="text-sm text-[var(--color-muted)]">
          ← Forside
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Tætteste og mest enige afstemninger
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          De mest tilspidsede afstemninger — hvor en håndfuld stemmer kunne
          have vendt resultatet — og dem hvor Folketinget stemte næsten
          enstemmigt. Kun afstemninger med mindst {MIN_DECIDED} stemmer for/imod
          tæller med (procedure‑afstemninger med få deltagere er udeladt).
        </p>
      </div>

      <form className="flex flex-wrap items-center gap-2 text-sm">
        <label className="text-[var(--color-muted)]">Periode:</label>
        <select
          name="gov"
          defaultValue={govSlug}
          className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5"
        >
          <option value="">Alle</option>
          {governments.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded border border-[var(--color-line)] px-3 py-1.5 hover:bg-[var(--color-soft)]"
        >
          Anvend
        </button>
        {govSlug && (
          <Link
            href="/analyse/afstemninger"
            className="ml-2 text-xs text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            Nulstil
          </Link>
        )}
      </form>

      <Section
        title="Tættest på at vippe"
        subtitle="Sorteret efter mindste forskel mellem for og imod (relativt)."
        rows={tightest}
        kind="tight"
      />

      <Section
        title="Mest enige"
        subtitle="Sorteret efter største opbakning (eller modstand) i procent."
        rows={mostUnited}
        kind="united"
      />
    </div>
  );
}

function Section({
  title,
  subtitle,
  rows,
  kind,
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  kind: "tight" | "united";
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          {title}
        </h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">Ingen data.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {rows.map((v) => (
            <li key={v.id}>
              <Link
                href={`/votes/${v.id}`}
                className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-1 py-2.5 hover:bg-[var(--color-soft)]"
              >
                <div className="min-w-0">
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
                    · {v.forCount} for / {v.imodCount} imod
                    {v.hverkenCount > 0 ? ` / ${v.hverkenCount} hverken` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs tabular-nums">
                  <div className="font-medium">
                    {kind === "tight"
                      ? `${(v.marginPct * 100).toFixed(1)}% margen`
                      : `${Math.round(v.marginPct * 100)}% enig`}
                  </div>
                  <div className="text-[var(--color-muted)]">
                    {v.margin === 0 ? "uafgjort" : `${v.margin} stemmers forskel`}
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
    </section>
  );
}
