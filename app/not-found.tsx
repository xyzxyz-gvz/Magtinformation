import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-6 py-10">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--color-muted)]">
        404
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        Siden findes ikke
      </h1>
      <p className="max-w-xl text-[var(--color-muted)]">
        Linket peger på en MF, en afstemning eller en side, vi ikke har data
        for. Det kan være at id'et er forkert, eller at indholdet er flyttet.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/"
          className="rounded-md border border-[var(--color-line)] px-3 py-1.5 hover:bg-[var(--color-soft)]"
        >
          ← Til forsiden
        </Link>
        <Link
          href="/votes"
          className="rounded-md border border-[var(--color-line)] px-3 py-1.5 hover:bg-[var(--color-soft)]"
        >
          Bladr i afstemninger
        </Link>
        <Link
          href="/members"
          className="rounded-md border border-[var(--color-line)] px-3 py-1.5 hover:bg-[var(--color-soft)]"
        >
          Bladr i medlemmer
        </Link>
      </div>
    </div>
  );
}
