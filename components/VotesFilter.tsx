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
  kind: string;
  q: string;
};

export function VotesFilter({
  governments,
  topics,
  govSlug,
  outcome,
  topic,
  kind,
  q,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchInput, setSearchInput] = useState(q);

  const buildUrl = (overrides: {
    gov?: string;
    outcome?: string;
    topic?: string;
    kind?: string;
    q?: string;
  }) => {
    const params = new URLSearchParams();
    const v = (k: keyof typeof overrides, fallback: string) =>
      overrides[k] ?? fallback;
    if (v("gov", govSlug)) params.set("gov", v("gov", govSlug));
    if (v("outcome", outcome)) params.set("outcome", v("outcome", outcome));
    if (v("topic", topic)) params.set("topic", v("topic", topic));
    if (v("kind", kind)) params.set("kind", v("kind", kind));
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

  const hasFilter = Boolean(govSlug || outcome || topic || kind || q);

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
        <select
          value={kind}
          onChange={(e) => navigate({ kind: e.target.value })}
          className="rounded border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm"
          aria-label="Sagstype"
        >
          <option value="">Alle sagstyper</option>
          <option value="L">L · Lovforslag</option>
          <option value="B">B · Beslutningsforslag</option>
          <option value="V">V · Forslag til vedtagelse</option>
          <option value="Borger">Borgerforslag</option>
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
      <details className="text-xs text-[var(--color-muted)]">
        <summary className="cursor-pointer select-none hover:text-[var(--color-ink)]">
          Hvad betyder L, B, V og Borgerforslag?
        </summary>
        <dl className="mt-2 grid gap-2 sm:grid-cols-2">
          <ExplainerRow
            term="L · Lovforslag"
            def="Bliver til lov hvis vedtaget. Stilles af regering eller MF'er."
          />
          <ExplainerRow
            term="B · Beslutningsforslag"
            def="Politisk pålæg til regeringen. Bliver ikke selv til lov."
          />
          <ExplainerRow
            term="V · Forslag til vedtagelse"
            def="Folketingets stillingtagen ifm. en debat — ofte til at markere holdning."
          />
          <ExplainerRow
            term="Borgerforslag"
            def="Forslag rejst af borgere via borgerforslag.dk. Behandles som beslutningsforslag, men er politisk distinct."
          />
        </dl>
      </details>
    </div>
  );
}

function ExplainerRow({ term, def }: { term: string; def: string }) {
  return (
    <div className="flex flex-col">
      <dt className="font-medium text-[var(--color-ink)]">{term}</dt>
      <dd className="text-[var(--color-muted)]">{def}</dd>
    </div>
  );
}
