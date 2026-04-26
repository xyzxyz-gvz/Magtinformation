import type { Member, Party } from "@/lib/types";

const EDUCATION_LABEL: Record<string, string> = {
  LVU: "Lang videregående",
  MVU: "Mellemlang videregående",
  KVU: "Kort videregående",
  Erhvervsfaglig: "Erhvervsfaglig",
  Gymnasial: "Gymnasial",
  Grundskole: "Grundskole",
};

const EDUCATION_ORDER = [
  "LVU",
  "MVU",
  "KVU",
  "Erhvervsfaglig",
  "Gymnasial",
  "Grundskole",
];

const AGE_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "Under 30", min: 0, max: 29 },
  { label: "30–39", min: 30, max: 39 },
  { label: "40–49", min: 40, max: 49 },
  { label: "50–59", min: 50, max: 59 },
  { label: "60–69", min: 60, max: 69 },
  { label: "70+", min: 70, max: 999 },
];

function ageAt(born: string, refDate: string): number | null {
  const b = new Date(born);
  const r = new Date(refDate);
  if (isNaN(b.getTime()) || isNaN(r.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const m = r.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < b.getDate())) age--;
  return age;
}

type Props = {
  members: Member[];
  parties?: Party[];
  refDate: string;
  showParty?: boolean;
  ageHint?: string;
};

export function DemographicStats({
  members,
  parties = [],
  refDate,
  showParty = true,
  ageHint,
}: Props) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Ingen MF'er i denne gruppe.
      </p>
    );
  }

  const partyByShort = new Map(parties.map((p) => [p.short, p]));

  const genderRows = aggregate(members, (m) => m.sex);
  const eduAgg = aggregate(members, (m) => m.educationStatistic);
  const eduRows = [
    ...EDUCATION_ORDER.filter((k) => eduAgg.byKey.get(k)).map((k) => ({
      key: k,
      label: EDUCATION_LABEL[k] ?? k,
      count: eduAgg.byKey.get(k)!,
      pct: pct(eduAgg.byKey.get(k)!, eduAgg.known),
    })),
    ...[...eduAgg.byKey.entries()]
      .filter(([k]) => !EDUCATION_ORDER.includes(k))
      .map(([k, count]) => ({
        key: k,
        label: k,
        count,
        pct: pct(count, eduAgg.known),
      })),
  ];

  const ageBuckets = AGE_BUCKETS.map((b) => ({ ...b, count: 0 }));
  let ageKnown = 0;
  let ageSum = 0;
  for (const m of members) {
    if (!m.born) continue;
    const a = ageAt(m.born, refDate);
    if (a == null || a < 18 || a > 110) continue;
    ageKnown++;
    ageSum += a;
    const bucket = ageBuckets.find((bk) => a >= bk.min && a <= bk.max);
    if (bucket) bucket.count++;
  }
  const avgAge = ageKnown ? Math.round(ageSum / ageKnown) : null;

  let partyRows: { label: string; count: number; pct: number; color: string }[] = [];
  if (showParty) {
    const partyCounts = new Map<string, number>();
    for (const m of members) {
      partyCounts.set(m.partyShort, (partyCounts.get(m.partyShort) ?? 0) + 1);
    }
    partyRows = [...partyCounts.entries()]
      .map(([short, count]) => ({
        label: partyByShort.get(short)?.navn ?? short,
        count,
        pct: pct(count, members.length),
        color: partyByShort.get(short)?.color ?? "#94a3b8",
        order: partyByShort.get(short)?.left_order ?? 99,
      }))
      .sort((a, b) => a.order - b.order || b.count - a.count);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Panel title="Køn" coverage={genderRows.known} total={members.length}>
        {genderRows.byKey.size === 0 ? (
          <Empty />
        ) : (
          <Bars
            rows={[...genderRows.byKey.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => ({
                label,
                count,
                pct: pct(count, genderRows.known),
                color: label === "Kvinde" ? "#8b5cf6" : "#0ea5e9",
              }))}
          />
        )}
      </Panel>

      <Panel
        title={`Alder${avgAge ? ` · gennemsnit ${avgAge} år` : ""}`}
        coverage={ageKnown}
        total={members.length}
        hint={ageHint ?? "Beregnet pr. dags dato."}
      >
        {ageKnown === 0 ? (
          <Empty />
        ) : (
          <Bars
            rows={ageBuckets
              .filter((b) => b.count > 0)
              .map((b) => ({
                label: b.label,
                count: b.count,
                pct: pct(b.count, ageKnown),
                color: "#0ea5e9",
              }))}
          />
        )}
      </Panel>

      <Panel
        title="Uddannelsesniveau"
        coverage={eduAgg.known}
        total={members.length}
        hint="LVU = lang videregående, MVU = mellemlang, KVU = kort videregående."
      >
        {eduRows.length === 0 ? (
          <Empty />
        ) : (
          <Bars
            rows={eduRows.map((r) => ({
              label: r.label,
              count: r.count,
              pct: r.pct,
              color: "#0ea5e9",
            }))}
          />
        )}
      </Panel>

      {showParty && partyRows.length > 0 && (
        <Panel
          title="Partifordeling"
          coverage={members.length}
          total={members.length}
        >
          <Bars rows={partyRows} />
        </Panel>
      )}
    </div>
  );
}

function aggregate(members: Member[], pick: (m: Member) => string | null) {
  const byKey = new Map<string, number>();
  let known = 0;
  for (const m of members) {
    const v = pick(m);
    if (!v) continue;
    byKey.set(v, (byKey.get(v) ?? 0) + 1);
    known++;
  }
  return { byKey, known };
}

function pct(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}

function Panel({
  title,
  coverage,
  total,
  hint,
  children,
}: {
  title: string;
  coverage: number;
  total: number;
  hint?: string;
  children: React.ReactNode;
}) {
  const p = total ? Math.round((coverage / total) * 100) : 0;
  return (
    <div className="rounded-lg border border-[var(--color-line)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs tabular-nums text-[var(--color-muted)]">
          data for {coverage}/{total} ({p}%)
        </span>
      </div>
      {hint && <p className="mt-1 text-xs text-[var(--color-muted)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Bars({
  rows,
}: {
  rows: { label: string; count: number; pct: number; color: string }[];
}) {
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-[var(--color-muted)]">
              {r.count} ({r.pct}%)
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-soft)]">
            <div
              className="h-full rounded-full"
              style={{ width: `${r.pct}%`, background: r.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return (
    <p className="text-xs text-[var(--color-muted)]">
      Ingen demografi tilgængelig.
    </p>
  );
}
