import Link from "next/link";
import { getVoteTopics } from "@/lib/data";

export const metadata = {
  title: "Emner — Magtinformation",
  description: "Alle emneord der er knyttet til afstemninger i Folketinget.",
};

export default async function TopicsIndex({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const voteTopics = await getVoteTopics();

  const counts = new Map<string, number>();
  for (const ts of Object.values(voteTopics)) {
    for (const t of ts) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }

  const needle = q.toLowerCase();
  const rows = [...counts.entries()]
    .filter(([t]) => !needle || t.toLowerCase().includes(needle))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Emner</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {rows.length.toLocaleString("da-DK")} emneord — sorteret efter antal
          afstemninger. Klik for at se alle relevante afstemninger og
          partifordelingen.
        </p>
      </div>

      <form className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Søg emne…"
          className="w-full rounded-md border border-[var(--color-line)] bg-white px-3 py-1.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm hover:bg-[var(--color-soft)]"
        >
          Søg
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Ingen emner matcher.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([t, n]) => (
            <li key={t}>
              <Link
                href={`/topics/${encodeURIComponent(t)}`}
                className="flex items-baseline justify-between gap-3 py-1 text-sm hover:underline"
              >
                <span className="truncate">{t}</span>
                <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
                  {n}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
