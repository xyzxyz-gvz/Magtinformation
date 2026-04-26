import { VOTE_COLORS } from "@/lib/types";

type Props = {
  forCount: number;
  imodCount: number;
  hverkenCount: number;
  fraværCount: number;
  /** When true, renders a wider bar with labels under it. */
  large?: boolean;
};

export function VoteBar({
  forCount,
  imodCount,
  hverkenCount,
  fraværCount,
  large = false,
}: Props) {
  const total = forCount + imodCount + hverkenCount + fraværCount;
  if (total === 0) return null;
  const pct = (n: number) => (n / total) * 100;

  const segments = [
    { key: "for", value: forCount, color: VOTE_COLORS[1] },
    { key: "imod", value: imodCount, color: VOTE_COLORS[2] },
    { key: "hverken", value: hverkenCount, color: VOTE_COLORS[4] },
    { key: "fravær", value: fraværCount, color: VOTE_COLORS[3] },
  ];

  return (
    <div
      className={large ? "w-full max-w-md" : "w-32 sm:w-40"}
      title={`${forCount} for · ${imodCount} imod · ${hverkenCount} hverken · ${fraværCount} fravær`}
    >
      <div
        className={`flex overflow-hidden rounded-full ${large ? "h-3" : "h-1.5"}`}
      >
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.key}
              style={{ width: `${pct(s.value)}%`, background: s.color }}
            />
          ) : null,
        )}
      </div>
      {large && (
        <div className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums text-[var(--color-muted)]">
          <span className="text-emerald-700">For {forCount}</span>
          <span className="text-rose-700">Imod {imodCount}</span>
          {hverkenCount > 0 && <span>Hverken {hverkenCount}</span>}
          {fraværCount > 0 && <span>Fravær {fraværCount}</span>}
        </div>
      )}
    </div>
  );
}
