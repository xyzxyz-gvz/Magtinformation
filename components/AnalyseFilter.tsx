"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Government } from "@/lib/types";

type Props = {
  governments: Government[];
  topics: string[];
  govSlug: string;
  topic: string;
};

export function AnalyseFilter({ governments, topics, govSlug, topic }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (next: { gov?: string; topic?: string }) => {
    const params = new URLSearchParams();
    const newGov = next.gov ?? govSlug;
    const newTopic = next.topic ?? topic;
    if (newGov) params.set("gov", newGov);
    if (newTopic) params.set("topic", newTopic);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const hasFilter = Boolean(govSlug || topic);

  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-[var(--color-line)] py-4">
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
  );
}
