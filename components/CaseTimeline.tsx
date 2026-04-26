import type { CaseTimelineStep } from "@/lib/data";

type Props = {
  timeline: CaseTimelineStep[];
  /** sagstrinid of the step belonging to the vote we're showing */
  highlightStepId?: number | null;
};

function formatDanish(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CaseTimeline({ timeline, highlightStepId }: Props) {
  if (timeline.length === 0) return null;

  return (
    <ol className="relative space-y-2 border-l border-[var(--color-line)] pl-5">
      {timeline.map((step) => {
        const active = step.id === highlightStepId;
        return (
          <li key={step.id} className="relative">
            <span
              className={`absolute -left-[27px] top-1.5 inline-block h-3 w-3 rounded-full border-2 border-white ${
                active ? "ring-2 ring-[var(--color-ink)]" : ""
              }`}
              style={{
                background: active ? "var(--color-ink)" : "#cbd5e1",
              }}
            />
            <div
              className={`flex flex-wrap items-baseline justify-between gap-3 rounded px-2 py-1 text-sm ${
                active
                  ? "bg-[var(--color-soft)] font-medium text-[var(--color-ink)]"
                  : "text-[var(--color-muted)]"
              }`}
            >
              <span>
                {step.titel ?? "Ukendt skridt"}
                {active && (
                  <span className="ml-2 rounded-full bg-[var(--color-ink)] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white">
                    Denne afstemning
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs tabular-nums">
                {formatDanish(step.dato)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
