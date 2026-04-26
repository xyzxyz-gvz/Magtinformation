"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CaseTypeBadge } from "@/components/CaseTypeBadge";

export type PartyVoteRow = {
  id: number;
  d: string;
  v: boolean; // vedtaget
  ct: string | null; // caseTitel
  cn: string | null; // caseNummer
  s: 1 | 2 | 4; // party majority stance: 1 for, 2 imod, 4 hverken
};

type Stance = "all" | "for" | "imod" | "hverken";

const TABS: { id: Stance; label: string; key: 1 | 2 | 4 | null }[] = [
  { id: "all", label: "Alle", key: null },
  { id: "for", label: "Stemt for", key: 1 },
  { id: "imod", label: "Stemt imod", key: 2 },
  { id: "hverken", label: "Hverken", key: 4 },
];

const PAGE = 25;

type Props = {
  votes: PartyVoteRow[];
  partyName: string;
};

export function PartyVotesExplorer({ votes, partyName }: Props) {
  const [active, setActive] = useState<Stance>("all");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    let f = 0,
      i = 0,
      h = 0;
    for (const v of votes) {
      if (v.s === 1) f++;
      else if (v.s === 2) i++;
      else if (v.s === 4) h++;
    }
    return { all: votes.length, for: f, imod: i, hverken: h };
  }, [votes]);

  const filtered = useMemo(() => {
    const tab = TABS.find((t) => t.id === active);
    let list = tab?.key == null ? votes : votes.filter((v) => v.s === tab.key);
    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((v) => {
        const ct = v.ct?.toLowerCase() ?? "";
        const cn = v.cn?.toLowerCase() ?? "";
        return ct.includes(needle) || cn.includes(needle);
      });
    }
    return list;
  }, [votes, active, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);

  const switchTab = (id: Stance) => {
    setActive(id);
    setPage(1);
  };

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Stemmer pr. stilling"
        className="-mx-1 flex flex-wrap gap-1"
      >
        {TABS.map((t) => {
          const cnt =
            t.id === "all"
              ? counts.all
              : t.id === "for"
                ? counts.for
                : t.id === "imod"
                  ? counts.imod
                  : counts.hverken;
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => switchTab(t.id)}
              className={`rounded-md border px-3 py-1.5 text-xs transition ${
                isActive
                  ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-white"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
              }`}
            >
              {t.label}
              <span
                className={`ml-1.5 tabular-nums ${
                  isActive ? "text-white/80" : "text-[var(--color-muted)]"
                }`}
              >
                {cnt.toLocaleString("da-DK")}
              </span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        placeholder={`Søg i de afstemninger ${partyName} har stemt om…`}
        className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
      />

      {slice.length === 0 ? (
        <p className="rounded border border-dashed border-[var(--color-line)] p-4 text-sm text-[var(--color-muted)]">
          Ingen afstemninger matcher.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {slice.map((v) => (
            <li key={v.id}>
              <Link
                href={`/votes/${v.id}`}
                className="flex items-baseline justify-between gap-4 py-2.5 hover:bg-[var(--color-soft)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <CaseTypeBadge caseNummer={v.cn} caseTitel={v.ct} />
                    <span className="truncate text-sm">
                      {v.ct ?? `Afstemning #${v.id}`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[var(--color-muted)]">
                    Partiet stemte{" "}
                    <span
                      className={
                        v.s === 1
                          ? "font-medium text-emerald-700"
                          : v.s === 2
                            ? "font-medium text-rose-700"
                            : "font-medium text-amber-700"
                      }
                    >
                      {v.s === 1 ? "for" : v.s === 2 ? "imod" : "hverken for/imod"}
                    </span>{" "}
                    ·{" "}
                    <span className={v.v ? "text-emerald-700" : "text-rose-700"}>
                      {v.v ? "vedtaget" : "forkastet"}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                  {v.d}
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
