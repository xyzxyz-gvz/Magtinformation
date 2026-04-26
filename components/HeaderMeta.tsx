import Link from "next/link";
import { getMeta } from "@/lib/data";

function formatShort(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  return date.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
  });
}

export async function HeaderMeta() {
  const meta = await getMeta();
  const updated = formatShort(meta.updated_at);
  if (!updated) return null;
  return (
    <Link
      href="/om"
      title={`Data senest opdateret ${updated}`}
      className="hidden text-xs text-[var(--color-muted)] no-underline hover:text-[var(--color-ink)] hover:no-underline sm:inline-flex sm:items-center sm:gap-1.5"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
      <span>Opdateret <span className="tabular-nums">{updated}</span></span>
    </Link>
  );
}
