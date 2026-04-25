import Link from "next/link";
import { PartyBadge } from "@/components/PartyBadge";
import { getGovernments, getParties, getVotesList } from "@/lib/data";
import { formatDateRange } from "@/lib/governments";

export default async function HomePage() {
  const [governments, parties, votes] = await Promise.all([
    getGovernments(),
    getParties(),
    getVotesList(),
  ]);

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const recentVotes = votes.slice(0, 8);

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hvad blev der stemt om?
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          Et hurtigt overblik over afstemninger i Folketinget — hvem stemte
          hvad, hvornår, og under hvilken regering.
        </p>
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
