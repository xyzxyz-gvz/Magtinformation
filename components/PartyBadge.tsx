import type { Party } from "@/lib/types";

type Size = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<Size, string> = {
  sm: "h-5 w-5 text-[11px]",
  md: "h-7 w-7 text-sm",
  lg: "h-10 w-10 text-base",
};

export function PartyBadge({
  party,
  size = "md",
}: {
  party: Party | undefined;
  size?: Size;
}) {
  if (!party) {
    return (
      <span
        className={`${SIZE_CLASSES[size]} inline-flex items-center justify-center rounded-full bg-[var(--color-soft)] font-semibold text-[var(--color-muted)]`}
      >
        ?
      </span>
    );
  }
  return (
    <span
      className={`${SIZE_CLASSES[size]} inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      style={{ background: party.color }}
      aria-label={party.navn}
      title={party.navn}
    >
      {party.letter}
    </span>
  );
}
