"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { VOTE_COLORS, VOTE_LABELS } from "@/lib/types";

export type ExplorerVote = {
  id: number;
  d: string;
  t: number;
  v: boolean;
  ct: string | null;
  cn: string | null;
  dev: boolean;
  topics: string[];
};

type Props = {
  votes: ExplorerVote[];
  topicCounts: { topic: string; count: number }[];
  minDate: string;
  maxDate: string;
  totalDeviation: number;
};

const PAGE = 25;

const VOTE_TYPE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Alle" },
  { value: 1, label: "For" },
  { value: 2, label: "Imod" },
  { value: 3, label: "Fravær" },
  { value: 4, label: "Hverken" },
];

export function MemberVotesExplorer({
  votes,
  topicCounts,
  minDate,
  maxDate,
  totalDeviation,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initial = useMemo(
    () => ({
      q: searchParams.get("q") ?? "",
      from: searchParams.get("from") ?? "",
      to: searchParams.get("to") ?? "",
      voteType: Number(searchParams.get("type") ?? "0") || 0,
      topic: searchParams.get("topic") ?? "",
      outcome: (searchParams.get("outcome") ?? "") as "" | "passed" | "rejected",
      onlyDev: searchParams.get("dev") === "1",
      page: Math.max(1, Number(searchParams.get("p") ?? "1") || 1),
    }),
    // Only seed once — subsequent URL updates come from this component itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [q, setQ] = useState(initial.q);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [voteType, setVoteType] = useState(initial.voteType);
  const [topic, setTopic] = useState(initial.topic);
  const [outcome, setOutcome] = useState<"" | "passed" | "rejected">(
    initial.outcome,
  );
  const [onlyDev, setOnlyDev] = useState(initial.onlyDev);
  const [page, setPage] = useState(initial.page);

  // Sync state → URL (replace, no history entry per keystroke).
  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (voteType !== 0) params.set("type", String(voteType));
    if (topic) params.set("topic", topic);
    if (outcome) params.set("outcome", outcome);
    if (onlyDev) params.set("dev", "1");
    if (page > 1) params.set("p", String(page));
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }, [q, from, to, voteType, topic, outcome, onlyDev, page, pathname, router, searchParams]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return votes.filter((v) => {
      if (from && v.d < from) return false;
      if (to && v.d > to) return false;
      if (voteType !== 0 && v.t !== voteType) return false;
      if (outcome === "passed" && !v.v) return false;
      if (outcome === "rejected" && v.v) return false;
      if (onlyDev && !v.dev) return false;
      if (topic && !v.topics.includes(topic)) return false;
      if (needle) {
        const ct = v.ct?.toLowerCase() ?? "";
        const cn = v.cn?.toLowerCase() ?? "";
        if (!ct.includes(needle) && !cn.includes(needle)) return false;
      }
      return true;
    });
  }, [votes, q, from, to, voteType, topic, outcome, onlyDev]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const reset = () => {
    setQ("");
    setFrom("");
    setTo("");
    setVoteType(0);
    setTopic("");
    setOutcome("");
    setOnlyDev(false);
    setPage(1);
  };

  const set = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const anyFilter =
    q || from || to || voteType !== 0 || topic || outcome || onlyDev;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted)]">Søg i titel/nr</span>
          <input
            type="search"
            value={q}
            onChange={(e) => set(setQ)(e.target.value)}
            placeholder="fx 'klima' eller 'L 24'"
            className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted)]">Stemte</span>
          <select
            value={voteType}
            onChange={(e) => set(setVoteType)(Number(e.target.value))}
            className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
          >
            {VOTE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted)]">Resultat</span>
          <select
            value={outcome}
            onChange={(e) =>
              set(setOutcome)(e.target.value as "" | "passed" | "rejected")
            }
            className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Alle</option>
            <option value="passed">Vedtaget</option>
            <option value="rejected">Forkastet</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted)]">Emne</span>
          <select
            value={topic}
            onChange={(e) => set(setTopic)(e.target.value)}
            className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Alle ({topicCounts.length})</option>
            {topicCounts.map((t) => (
              <option key={t.topic} value={t.topic}>
                {t.topic} ({t.count})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted)]">Fra dato</span>
          <input
            type="date"
            value={from}
            min={minDate}
            max={maxDate}
            onChange={(e) => set(setFrom)(e.target.value)}
            className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-[var(--color-muted)]">Til dato</span>
          <input
            type="date"
            value={to}
            min={minDate}
            max={maxDate}
            onChange={(e) => set(setTo)(e.target.value)}
            className="rounded border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
          />
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyDev}
            onChange={(e) => set(setOnlyDev)(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-line)]"
          />
          <span>
            Kun afvigelser{" "}
            <span className="text-xs text-[var(--color-muted)]">
              ({totalDeviation.toLocaleString("da-DK")})
            </span>
          </span>
        </label>
        <div className="flex items-end">
          {anyFilter && (
            <button
              type="button"
              onClick={reset}
              className="rounded border border-[var(--color-line)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
            >
              Nulstil filtre
            </button>
          )}
        </div>
      </div>

      <div className="flex items-baseline justify-between text-xs text-[var(--color-muted)]">
        <span>
          {filtered.length.toLocaleString("da-DK")} resultat
          {filtered.length === 1 ? "" : "er"}
          {filtered.length !== votes.length && (
            <> af {votes.length.toLocaleString("da-DK")}</>
          )}
        </span>
        {totalPages > 1 && (
          <span>
            Side {safePage} af {totalPages.toLocaleString("da-DK")}
          </span>
        )}
      </div>

      {slice.length === 0 ? (
        <p className="rounded border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
          Ingen afstemninger matcher.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {slice.map((mv) => (
            <li key={mv.id}>
              <Link
                href={`/votes/${mv.id}`}
                className="flex items-baseline justify-between gap-6 py-2.5 hover:bg-[var(--color-soft)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ background: VOTE_COLORS[mv.t] }}
                      title={VOTE_LABELS[mv.t] ?? "?"}
                    />
                    <span className="truncate text-sm">
                      {mv.ct ?? `Afstemning #${mv.id}`}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 pl-4 text-xs text-[var(--color-muted)]">
                    <span>{(VOTE_LABELS[mv.t] ?? "?").toLowerCase()}</span>
                    <span>·</span>
                    <span className={mv.v ? "text-emerald-700" : "text-rose-700"}>
                      {mv.v ? "Vedtaget" : "Forkastet"}
                    </span>
                    {mv.cn && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">{mv.cn}</span>
                      </>
                    )}
                    {mv.dev && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-amber-700">
                          mod eget parti
                        </span>
                      </>
                    )}
                    {mv.topics.length > 0 && (
                      <>
                        <span>·</span>
                        <span className="truncate">
                          {mv.topics.slice(0, 3).join(", ")}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                  {mv.d}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage(safePage - 1)}
            className="rounded border border-[var(--color-line)] px-3 py-1 disabled:opacity-40"
          >
            ← Forrige
          </button>
          <span className="text-xs text-[var(--color-muted)]">
            Side {safePage} af {totalPages.toLocaleString("da-DK")}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => setPage(safePage + 1)}
            className="rounded border border-[var(--color-line)] px-3 py-1 disabled:opacity-40"
          >
            Næste →
          </button>
        </div>
      )}
    </div>
  );
}
