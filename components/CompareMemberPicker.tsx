"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type IndexMember = {
  id: number;
  navn: string;
  partyShort: string;
  isCurrentMF: boolean;
};

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function CompareMemberPicker({
  initialA = "",
  initialB = "",
}: {
  initialA?: string;
  initialB?: string;
}) {
  const router = useRouter();
  const [a, setA] = useState(initialA);
  const [b, setB] = useState(initialB);
  const [index, setIndex] = useState<IndexMember[] | null>(null);

  useEffect(() => {
    fetch("/data/search_index.json")
      .then((r) => r.json())
      .then((d) => setIndex(d.members ?? []))
      .catch(() => setIndex([]));
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (a && b) router.push(`/members/sammenlign?a=${a}&b=${b}`);
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <Picker label="MF A" value={a} onChange={setA} index={index} />
      <Picker label="MF B" value={b} onChange={setB} index={index} />
      <button
        type="submit"
        disabled={!a || !b || a === b}
        className="self-end rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm hover:bg-[var(--color-soft)] disabled:opacity-40"
      >
        Sammenlign
      </button>
    </form>
  );
}

function Picker({
  label,
  value,
  onChange,
  index,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  index: IndexMember[] | null;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    if (!index || !value) return null;
    return index.find((m) => String(m.id) === value) ?? null;
  }, [index, value]);

  const hits = useMemo(() => {
    if (!index) return [];
    const needle = normalize(query.trim());
    if (!needle) return [];
    return index
      .filter((m) => normalize(m.navn).includes(needle))
      .sort(
        (a, b) =>
          Number(b.isCurrentMF) - Number(a.isCurrentMF) ||
          a.navn.localeCompare(b.navn, "da"),
      )
      .slice(0, 8);
  }, [index, query]);

  return (
    <div className="relative">
      <label className="block text-xs text-[var(--color-muted)]">{label}</label>
      <input
        type="search"
        value={selected ? selected.navn : query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (selected) onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Søg MF…"
        className="mt-1 w-full rounded-md border border-[var(--color-line)] bg-white px-2.5 py-1.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
      />
      {open && hits.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border border-[var(--color-line)] bg-white shadow-lg">
          {hits.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(String(m.id));
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-soft)]"
              >
                <span className="truncate">{m.navn}</span>
                <span className="shrink-0 text-xs text-[var(--color-muted)]">
                  {m.partyShort}
                  {!m.isCurrentMF && " · tidl."}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
