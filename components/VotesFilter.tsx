"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Government } from "@/lib/types";

type Props = {
  governments: Government[];
  topics: string[];
  govSlug: string;
  outcome: string;
  topic: string;
  q: string;
};

export function VotesFilter({
  governments,
  topics,
  govSlug,
  outcome,
  topic,
  q,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q);

  const buildUrl = (overrides: {
    gov?: string;
    outcome?: string;
    topic?: string;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    const v = (k: keyof typeof overrides, fallback: string) =>
      overrides[k] ?? fallback;
    if (v("gov", govSlug)) params.set("gov", v("gov", govSlug));
    if (v("outcome", outcome)) params.set("outcome", v("outcome", outcome));
    if (v("topic", topic)) params.set("topic", v("topic", topic));
    if (v("q", q)) params.set("q", v("q", q));
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const navigate = (overrides: Parameters<typeof buildUrl>[0]) => {
    router.push(buildUrl(overrides));
  };

  useEffect(() => {
    if (searchInput === q) return;
    const t = setTimeout(() => navigate({ q: searchInput }), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const hasFilter = Boolean(govSlug || outcome || topic || q);

  return (
    <div className="space-y-3 border-y border-[var(--color-line)] py-4">
      <input
        type="search"
        placeholder="Søg i titel eller konklusion…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full rounded border border-[var(--color-line)] bg-white px-3 py-2 text-sm focus:border-[var(--color-ink)] focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={govSlug}
          onChange={(e) => navigate({ gov: e.target.value })}
          className="rounded border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Alle regeringer</option>
          {governments.map((g) => (
            <option key={g.slug} value={g.slug}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={outcome}
          onChange={(e) => navigate({ outcome: e.target.value })}
          className="rounded border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Alle udfald</option>
          <option value="passed">Vedtaget</option>
          <option value="rejected">Forkastet</option>
        </select>
        <select
          value={topic}
          onChange={(e) => navigate({ topic: e.target.value })}
          className="rounded border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Alle emner</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {hasFilter && (
          <Link
            href={pathname}
            className="text-sm text-[var(--color-muted)] underline-offset-2 hover:underline"
          >
            Nulstil
          </Link>
        )}
      </div>
    </div>
  );
}
