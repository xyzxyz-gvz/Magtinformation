import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyBadge } from "@/components/PartyBadge";
import { getGovernments, getParties, getVotesList } from "@/lib/data";
import { formatDate, formatDateRange } from "@/lib/governments";

export async function generateStaticParams() {
  const governments = await getGovernments();
  return governments.map((g) => ({ slug: g.slug }));
}

export default async function GovernmentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [governments, parties, votes] = await Promise.all([
    getGovernments(),
    getParties(),
    getVotesList(),
  ]);
  const government = governments.find((g) => g.slug === slug);
  if (!government) notFound();

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const periodVotes = votes.filter(
    (v) =>
      v.dato >= government.start &&
      (government.end === null || v.dato < government.end),
  );

  const passed = periodVotes.filter((v) => v.vedtaget).length;
  const passRate = periodVotes.length
    ? Math.round((passed / periodVotes.length) * 100)
    : 0;

  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/"
          className="text-sm text-[var(--color-muted)]"
        >
          ← Forside
        </Link>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {government.name}
        </h1>
        <div className="mt-2 text-sm text-[var(--color-muted)]">
          {formatDateRange(government)} · {government.type}
        </div>
        <p className="mt-4 max-w-2xl">{government.description}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {government.parties.map((short) => {
            const p = partyByShort.get(short);
            return (
              <span
                key={short}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] py-1 pr-3 pl-1 text-sm"
              >
                <PartyBadge party={p} size="sm" />
                {p?.navn ?? short}
              </span>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 border-y border-[var(--color-line)] py-6">
        <Stat label="Afstemninger" value={periodVotes.length.toLocaleString("da-DK")} />
        <Stat label="Vedtaget" value={`${passed.toLocaleString("da-DK")}`} />
        <Stat label="Vedtaget-rate" value={`${passRate}%`} />
      </div>

      <section>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Afstemninger under denne regering
        </h2>
        {periodVotes.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            Ingen afstemninger i denne periode.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {periodVotes.slice(0, 50).map((v) => (
              <li key={v.id}>
                <Link
                  href={`/votes/${v.id}`}
                  className="flex items-baseline justify-between gap-6 py-3 hover:bg-[var(--color-soft)]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">
                      {v.caseTitel ?? v.konklusion ?? `Afstemning #${v.id}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm tabular-nums text-[var(--color-muted)]">
                    {formatDate(v.dato)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {periodVotes.length > 50 && (
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Viser de første 50 af {periodVotes.length.toLocaleString("da-DK")}.
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        {label}
      </div>
    </div>
  );
}
