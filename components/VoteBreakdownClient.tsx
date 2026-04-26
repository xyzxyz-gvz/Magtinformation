"use client";

import Link from "next/link";
import { useState } from "react";
import { VOTE_COLORS, VOTE_LABELS } from "@/lib/types";

export type BreakdownGroup = {
  partyShort: string;
  partyName: string;
  partyLetter: string;
  partyColor: string;
  partyOrder: number;
  members: { id: number; navn: string; voteType: number }[];
  counts: { for: number; imod: number; fravær: number; hverken: number };
};

type FilterType = 0 | 1 | 2 | 3 | 4;
type ViewMode = "dots" | "list";

const FILTER_OPTIONS: { value: FilterType; label: string }[] = [
  { value: 0, label: "Alle" },
  { value: 1, label: "For" },
  { value: 2, label: "Imod" },
  { value: 3, label: "Fravær" },
  { value: 4, label: "Hverken" },
];

export function VoteBreakdownClient({ groups }: { groups: BreakdownGroup[] }) {
  const [filter, setFilter] = useState<FilterType>(0);
  const [view, setView] = useState<ViewMode>("dots");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-md border border-[var(--color-line)] p-0.5">
          {FILTER_OPTIONS.map((opt) => {
            const active = filter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFilter(opt.value)}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs transition ${
                  active
                    ? "bg-[var(--color-ink)] text-white"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
                }`}
              >
                {opt.value !== 0 && (
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: VOTE_COLORS[opt.value] }}
                  />
                )}
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex rounded-md border border-[var(--color-line)] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("dots")}
            className={`rounded px-2 py-1 ${
              view === "dots"
                ? "bg-[var(--color-ink)] text-white"
                : "text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
            }`}
          >
            Prikker
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded px-2 py-1 ${
              view === "list"
                ? "bg-[var(--color-ink)] text-white"
                : "text-[var(--color-muted)] hover:bg-[var(--color-soft)]"
            }`}
          >
            Navne
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((row) => {
          const visible =
            filter === 0 ? row.members : row.members.filter((m) => m.voteType === filter);
          const total = row.members.length;
          const showingAll = filter === 0;
          const isExpanded = expanded.has(row.partyShort) || view === "list";

          return (
            <div
              key={row.partyShort}
              className="rounded-lg border px-3 py-2.5"
              style={{ borderColor: row.partyColor }}
            >
              <button
                type="button"
                onClick={() => toggle(row.partyShort)}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
                    style={{ background: row.partyColor }}
                  >
                    {row.partyLetter}
                  </span>
                  <span className="text-sm font-medium">{row.partyName}</span>
                  <span className="text-xs tabular-nums text-[var(--color-muted)]">
                    {showingAll ? total : `${visible.length}/${total}`}
                  </span>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-3 text-xs tabular-nums text-[var(--color-muted)]">
                  <Tally type={1} count={row.counts.for} active={filter === 1} />
                  <Tally type={2} count={row.counts.imod} active={filter === 2} />
                  <Tally type={3} count={row.counts.fravær} active={filter === 3} />
                  {row.counts.hverken > 0 && (
                    <Tally type={4} count={row.counts.hverken} active={filter === 4} />
                  )}
                  <span className="text-[var(--color-muted)]">
                    {isExpanded ? "▾" : "▸"}
                  </span>
                </div>
              </button>

              {visible.length === 0 ? (
                <div className="mt-2 text-xs text-[var(--color-muted)]">
                  Ingen medlemmer matcher filteret.
                </div>
              ) : view === "dots" && !isExpanded ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {visible.map((m) => (
                    <Link
                      key={m.id}
                      href={`/members/${m.id}`}
                      className="inline-block h-3 w-3 rounded-full transition hover:ring-2 hover:ring-[var(--color-ink)]"
                      style={{ background: VOTE_COLORS[m.voteType] }}
                      title={`${m.navn} — ${VOTE_LABELS[m.voteType] ?? "?"}`}
                    />
                  ))}
                </div>
              ) : (
                <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                  {visible.map((m) => (
                    <li key={m.id}>
                      <Link
                        href={`/members/${m.id}`}
                        className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-[var(--color-soft)]"
                      >
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ background: VOTE_COLORS[m.voteType] }}
                          title={VOTE_LABELS[m.voteType] ?? "?"}
                        />
                        <span className="truncate">{m.navn}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Tally({
  type,
  count,
  active,
}: {
  type: number;
  count: number;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 ${
        active ? "font-medium text-[var(--color-ink)]" : ""
      }`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: VOTE_COLORS[type] }}
      />
      {count} {VOTE_LABELS[type]?.toLowerCase()}
    </span>
  );
}
