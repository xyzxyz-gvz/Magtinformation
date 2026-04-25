import Link from "next/link";
import { notFound } from "next/navigation";
import { VoteBreakdown } from "@/components/VoteBreakdown";
import {
  getEnrichedVote,
  getGovernments,
  getMembers,
  getParties,
  getVote,
} from "@/lib/data";
import { getGovernmentForDate } from "@/lib/governments";
import { VOTE_COLORS, VOTE_LABELS } from "@/lib/types";

export default async function VoteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const voteId = Number(id);
  if (!Number.isFinite(voteId)) notFound();

  const [vote, enriched, governments, members, parties] = await Promise.all([
    getVote(voteId),
    getEnrichedVote(voteId),
    getGovernments(),
    getMembers(),
    getParties(),
  ]);

  if (!vote) notFound();

  const government = getGovernmentForDate(governments, vote.dato);
  const total =
    vote.forCount + vote.imodCount + vote.fraværCount + vote.hverkenCount;

  return (
    <div className="space-y-10">
      <div>
        <Link href="/votes" className="text-sm text-[var(--color-muted)]">
          ← Afstemninger
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {vote.caseTitel ?? vote.konklusion ?? `Afstemning #${vote.id}`}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--color-muted)]">
          <span className="tabular-nums">{vote.dato}</span>
          <span>·</span>
          <span>{vote.type ?? "Afstemning"}</span>
          {government && (
            <>
              <span>·</span>
              <Link
                href={`/governments/${government.slug}`}
                className="underline-offset-2 hover:underline"
              >
                {government.name}
              </Link>
            </>
          )}
        </div>
        <div
          className={`mt-3 inline-block rounded px-2.5 py-0.5 text-sm ${
            vote.vedtaget
              ? "bg-emerald-50 text-emerald-800"
              : "bg-rose-50 text-rose-800"
          }`}
        >
          {vote.vedtaget ? "Vedtaget" : "Forkastet"}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Tally type={1} count={vote.forCount} total={total} />
        <Tally type={2} count={vote.imodCount} total={total} />
        <Tally type={3} count={vote.fraværCount} total={total} />
        <Tally type={4} count={vote.hverkenCount} total={total} />
      </div>

      {vote.konklusion && (
        <section>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Konklusion
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">
            {vote.konklusion}
          </p>
        </section>
      )}

      {enriched ? (
        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
            Stemmer pr. parti
          </h2>
          <VoteBreakdown
            vote={enriched}
            members={members}
            parties={parties}
          />
          <p className="mt-3 text-xs text-[var(--color-muted)]">
            Hver prik er ét medlem. Farven viser hvad vedkommende stemte.
            Rammen om hver gruppe er partifarven.
          </p>
        </section>
      ) : (
        <p className="rounded border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
          Detaljerede stemmer er kun tilgængelige for de seneste afstemninger.
        </p>
      )}
    </div>
  );
}

function Tally({
  type,
  count,
  total,
}: {
  type: number;
  count: number;
  total: number;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="rounded border border-[var(--color-line)] p-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[var(--color-muted)]">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: VOTE_COLORS[type] }}
        />
        {VOTE_LABELS[type]}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{count}</div>
      <div className="text-xs text-[var(--color-muted)]">{pct}%</div>
    </div>
  );
}
