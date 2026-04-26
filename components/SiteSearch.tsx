"use client";

import { useRouter } from "next/navigation";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type IndexMember = {
  id: number;
  navn: string;
  partyShort: string;
  isCurrentMF: boolean;
};

type IndexTopic = { t: string; n: number };

type SearchIndex = {
  members: IndexMember[];
  topics: IndexTopic[];
};

type Hit =
  | { kind: "member"; m: IndexMember }
  | { kind: "topic"; t: IndexTopic }
  | { kind: "search"; q: string };

const MAX_RESULTS = 8;

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function SiteSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ensureIndex = useCallback(async () => {
    if (index || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/data/search_index.json");
      const data = (await res.json()) as SearchIndex;
      setIndex(data);
    } catch {
      // ignore — fallback is free-text search
    } finally {
      setLoading(false);
    }
  }, [index, loading]);

  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim();
    if (!q) return [];
    const out: Hit[] = [];
    if (index) {
      const needle = normalize(q);
      const memberMatches = index.members
        .filter((m) => normalize(m.navn).includes(needle))
        .sort(
          (a, b) =>
            Number(b.isCurrentMF) - Number(a.isCurrentMF) ||
            a.navn.localeCompare(b.navn, "da"),
        )
        .slice(0, MAX_RESULTS - 2);
      for (const m of memberMatches) out.push({ kind: "member", m });

      const remaining = MAX_RESULTS - out.length - 1;
      if (remaining > 0) {
        const topicMatches = index.topics
          .filter((t) => normalize(t.t).includes(needle))
          .slice(0, remaining);
        for (const t of topicMatches) out.push({ kind: "topic", t });
      }
    }
    out.push({ kind: "search", q });
    return out;
  }, [query, index]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  const navigate = useCallback(
    (h: Hit) => {
      setOpen(false);
      setQuery("");
      if (h.kind === "member") router.push(`/members/${h.m.id}`);
      else if (h.kind === "topic")
        router.push(`/votes?topic=${encodeURIComponent(h.t.t)}`);
      else router.push(`/votes?q=${encodeURIComponent(h.q)}`);
    },
    [router],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        navigate({ kind: "search", q: query.trim() });
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigate(hits[active]);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-64">
      <input
        ref={inputRef}
        type="search"
        value={query}
        placeholder="Søg…  ⌘K"
        aria-label="Søg på sitet"
        onFocus={() => {
          setOpen(true);
          ensureIndex();
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
        className="w-full rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm placeholder:text-[var(--color-muted)] focus:border-[var(--color-ink)] focus:outline-none"
      />
      {open && query.trim() && hits.length > 0 && (
        <ul
          className="absolute right-0 z-30 mt-1 max-h-96 w-full overflow-auto rounded-md border border-[var(--color-line)] bg-white py-1 shadow-lg sm:w-[28rem]"
          role="listbox"
        >
          {hits.map((h, i) => {
            const isActive = i === active;
            const cls = `flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm ${
              isActive ? "bg-[var(--color-soft)]" : ""
            }`;
            if (h.kind === "member") {
              return (
                <li key={`m-${h.m.id}`}>
                  <button
                    type="button"
                    className={cls}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => navigate(h)}
                  >
                    <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                      MF
                    </span>
                    <span className="truncate">{h.m.navn}</span>
                    <span className="ml-auto shrink-0 text-xs text-[var(--color-muted)]">
                      {h.m.partyShort}
                      {!h.m.isCurrentMF && " · tidl."}
                    </span>
                  </button>
                </li>
              );
            }
            if (h.kind === "topic") {
              return (
                <li key={`t-${h.t.t}`}>
                  <button
                    type="button"
                    className={cls}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => navigate(h)}
                  >
                    <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                      Emne
                    </span>
                    <span className="truncate">{h.t.t}</span>
                    <span className="ml-auto shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                      {h.t.n}
                    </span>
                  </button>
                </li>
              );
            }
            return (
              <li key="search-all">
                <button
                  type="button"
                  className={cls}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => navigate(h)}
                >
                  <span className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
                    Søg
                  </span>
                  <span className="truncate">
                    Find &quot;{h.q}&quot; i alle afstemninger
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
