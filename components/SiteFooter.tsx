import Link from "next/link";
import { getMeta } from "@/lib/data";

function formatDate(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("da-DK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export async function SiteFooter() {
  const meta = await getMeta();
  const updated = formatDate(meta.updated_at);

  return (
    <footer className="mt-20 border-t border-[var(--color-line)] py-6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-6 text-xs text-[var(--color-muted)]">
        <div>
          Data fra Folketingets åbne data —{" "}
          <a
            href="https://oda.ft.dk"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-2 hover:underline"
          >
            oda.ft.dk
          </a>
          {updated && (
            <>
              {" · "}sidst opdateret <span className="tabular-nums">{updated}</span>
            </>
          )}
        </div>
        <div className="flex gap-4">
          <Link href="/om" className="hover:underline">
            Om & metode
          </Link>
          <Link href="/om#privatliv" className="hover:underline">
            Privatliv
          </Link>
        </div>
      </div>
    </footer>
  );
}
