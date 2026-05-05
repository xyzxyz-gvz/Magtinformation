import type {
  PartyFinanceDonor,
  PartyFinanceMeta,
  PartyFinanceYear,
} from "@/lib/types";

type Props = {
  partyName: string;
  years: { year: string; data: PartyFinanceYear }[];
  meta: PartyFinanceMeta | null;
};

const DONOR_TYPE_LABEL: Record<PartyFinanceDonor["type"], string> = {
  union: "Fagforeninger",
  association: "Foreninger",
  company: "Virksomheder",
  fund: "Fonde",
  person: "Privatpersoner",
};

const DONOR_TYPE_ICON: Record<PartyFinanceDonor["type"], string> = {
  union: "👷",
  association: "🏛",
  company: "🏢",
  fund: "🪙",
  person: "👤",
};

function formatThousands(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Format an amount in t.kr. as kr (e.g. 30523 t.kr. → "30,5 mio. kr.") */
function formatAmount(tkr: number | null): string {
  if (tkr == null) return "—";
  if (Math.abs(tkr) >= 1000) {
    const mio = tkr / 1000;
    const formatted = mio.toFixed(1).replace(".", ",");
    return `${formatted} mio. kr.`;
  }
  return `${formatThousands(tkr)} t.kr.`;
}

/** Compact form for table cells: only the number + unit suffix. */
function formatCell(tkr: number | null): string {
  if (tkr == null) return "—";
  if (Math.abs(tkr) >= 1000) {
    return `${(tkr / 1000).toFixed(1).replace(".", ",")} mio.`;
  }
  return formatThousands(tkr);
}

function pctChange(current: number | null, prev: number | null): number | null {
  if (current == null || prev == null || prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

export function PartyFinances({ partyName, years, meta }: Props) {
  if (years.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-sm">
        <div className="font-medium">Ingen partiregnskab i datasættet endnu</div>
        <p className="mt-1 text-[var(--color-muted)]">
          Folketinget offentliggør årlige regnskaber for de partier der har
          været opstillet til folketingsvalg eller europaparlamentsvalg.{" "}
          <a
            href="https://www.ft.dk/da/dokumenter/dokumentlister/partiregnskaber"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Bladr originalerne på ft.dk
          </a>
          .
        </p>
      </div>
    );
  }

  const latest = years[0];

  return (
    <div className="space-y-12">
      <p className="max-w-2xl text-sm text-[var(--color-muted)]">
        Hvor får {partyName} sine penge fra? Tallene nedenfor stammer fra
        partiets egne offentliggjorte landsorganisations‑regnskaber, som
        Folketinget kræver i medfør af partiregnskabsloven. Beløbene er i
        tusinde kroner (t.kr.) som de står i originalen.
      </p>

      <DonorSection partyName={partyName} years={years} latest={latest} />

      <ComparativeTable years={years} />

      {meta && (
        <p className="text-xs text-[var(--color-muted)]">
          Kilde: {meta.source}.{" "}
          <a
            href={meta.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Originale regnskaber på ft.dk ↗
          </a>
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Donor section
// ---------------------------------------------------------------------------

type DonorKind = "in_kind" | "monetary" | "partiskat";

const KIND_HEADING: Record<DonorKind, string> = {
  in_kind: "Mødefaciliteter & andre faciliteter",
  monetary: "Organisationer, virksomheder, foreninger og fonde",
  partiskat: "Folkevalgte (via partiskat)",
};

const KIND_DESCRIPTION: Record<DonorKind, string> = {
  in_kind:
    "Stillet til rådighed (lokaler, IT, mv.) — ikke kontant, men lovpligtigt indberettet.",
  monetary: "Kontante bidrag over indberetningsgrænsen (~20.000 kr.).",
  partiskat:
    "Folketingsmedlemmer og ministre der har indbetalt mere end indberetningsgrænsen i partiskat.",
};

function donorKind(d: PartyFinanceDonor): DonorKind {
  if (d.kind) return d.kind;
  // Backwards-compat heuristic for records lacking kind.
  if (d.type === "person") return "partiskat";
  return "monetary";
}

function DonorSection({
  partyName,
  years,
  latest,
}: {
  partyName: string;
  years: { year: string; data: PartyFinanceYear }[];
  latest: { year: string; data: PartyFinanceYear };
}) {
  const totalAcrossYears = new Set(
    years.flatMap((y) =>
      (y.data.donors ?? []).map((d) => d.name.toLowerCase()),
    ),
  ).size;
  const yearsWithDonors = years.filter(
    (y) => (y.data.donors ?? []).length > 0,
  );

  return (
    <section>
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--color-line)] pb-4">
        <div>
          <h3 className="text-2xl font-semibold tracking-tight">
            Private bidragydere
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-muted)]">
            Partiregnskabsloven kræver, at bidragydere som over et regnskabsår
            har givet mere end ca. 20.000 kr. fremgår med navn — også når der er
            tale om faciliteter stillet til rådighed eller folkevalgte der
            indbetaler partiskat. {partyName} har samlet haft{" "}
            <strong>{totalAcrossYears}</strong>{" "}
            navngivne bidragydere i perioden{" "}
            {years[years.length - 1].year}–{latest.year}.
          </p>
        </div>
        {latest.data.anonymeTilskud != null && latest.data.anonymeTilskud > 0 && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800 ring-1 ring-amber-200">
            {formatAmount(latest.data.anonymeTilskud)} i anonyme tilskud{" "}
            {latest.year}
          </span>
        )}
      </header>

      {yearsWithDonors.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-muted)]">
          Ingen navngivne bidragydere er registreret i datasættet endnu.
          {" "}Detaljer fra de offentliggjorte regnskaber kan tilføjes manuelt.
        </div>
      ) : (
        <div className="space-y-8">
          {years.map(({ year, data }) => (
            <DonorYearBlock
              key={year}
              year={year}
              donors={data.donors ?? []}
              anonyme={data.anonymeTilskud}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function DonorYearBlock({
  year,
  donors,
  anonyme,
}: {
  year: string;
  donors: PartyFinanceDonor[];
  anonyme: number | null;
}) {
  const byKind = groupDonorsByKind(donors);
  const total = donors.length;

  return (
    <div className="rounded-xl border border-[var(--color-line)] p-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-xl font-semibold tracking-tight">{year}</h4>
        <span className="text-xs text-[var(--color-muted)]">
          {total === 0 ? "ingen registrerede" : `${total} bidragyder${total === 1 ? "" : "e"}`}
          {anonyme != null && anonyme > 0 && (
            <>
              {" · "}
              <span className="text-amber-700">
                {formatAmount(anonyme)} anonyme
              </span>
            </>
          )}
        </span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-[var(--color-muted)]">
          Ingen navngivne bidragydere over indberetningsgrænsen.
        </p>
      ) : (
        <div className="space-y-5">
          {(["in_kind", "monetary", "partiskat"] as const).map((kind) => {
            const list = byKind[kind];
            if (!list || list.length === 0) return null;
            return <DonorKindGroup key={kind} kind={kind} donors={list} />;
          })}
        </div>
      )}
    </div>
  );
}

function DonorKindGroup({
  kind,
  donors,
}: {
  kind: DonorKind;
  donors: PartyFinanceDonor[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <h5 className="text-sm font-medium">{KIND_HEADING[kind]}</h5>
        <span className="text-xs text-[var(--color-muted)]">
          ({donors.length})
        </span>
      </div>
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        {KIND_DESCRIPTION[kind]}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {donors.map((d, idx) => (
          <li
            key={`${d.name}-${idx}`}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-soft)] px-3 py-1.5 text-sm"
            title={
              [
                d.note,
                d.amount != null ? `${formatAmount(d.amount)}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined
            }
          >
            <span aria-hidden className="text-base leading-none">
              {DONOR_TYPE_ICON[d.type]}
            </span>
            <span className="flex-1 truncate">{d.name}</span>
            {d.amount != null && (
              <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs tabular-nums text-[var(--color-muted)] ring-1 ring-[var(--color-line)]">
                {formatAmount(d.amount)}
              </span>
            )}
            {d.note && d.amount == null && (
              <span className="shrink-0 text-xs text-[var(--color-muted)]">
                {d.note}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function groupDonorsByKind(
  donors: PartyFinanceDonor[],
): Record<DonorKind, PartyFinanceDonor[]> {
  const out: Record<DonorKind, PartyFinanceDonor[]> = {
    in_kind: [],
    monetary: [],
    partiskat: [],
  };
  for (const d of donors) {
    out[donorKind(d)].push(d);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Comparative income statement
// ---------------------------------------------------------------------------

type RowKind = "line" | "subtotal" | "spacer";

type Row = {
  label: string;
  field: keyof PartyFinanceYear | null; // null for spacer
  kind: RowKind;
  /** When true, an upward change is "good" (revenue/equity); when false,
   *  it's "bad" (costs). Affects delta colour. */
  upIsGood?: boolean;
  /** Indented = subcomponent of a subtotal */
  indent?: boolean;
};

const ROWS: Row[] = [
  { label: "Indtægter", field: null, kind: "spacer" },
  { label: "Offentlig partistøtte", field: "offentligPartistotte", kind: "line", upIsGood: true, indent: true },
  { label: "Medlemskontingenter", field: "medlemskontingenter", kind: "line", upIsGood: true, indent: true },
  { label: "Private personer", field: "privatePersoner", kind: "line", upIsGood: true, indent: true },
  { label: "Faglige org., virksomheder, fonde m.v.", field: "organisationer", kind: "line", upIsGood: true, indent: true },
  { label: "Andre indtægter", field: "andreIndtaegter", kind: "line", upIsGood: true, indent: true },
  { label: "Primære indtægter", field: "indtaegterTotal", kind: "subtotal", upIsGood: true },
  { label: "Udgifter", field: null, kind: "spacer" },
  { label: "Omkostninger i alt", field: "udgifterTotal", kind: "subtotal", upIsGood: false },
  { label: "Årets resultat", field: "aaretsResultat", kind: "subtotal", upIsGood: true },
  { label: "Balance", field: null, kind: "spacer" },
  { label: "Egenkapital", field: "egenkapital", kind: "subtotal", upIsGood: true },
];

function ComparativeTable({
  years,
}: {
  years: { year: string; data: PartyFinanceYear }[];
}) {
  // Show at most 6 most-recent years to keep the table readable.
  const cols = years.slice(0, 6);

  return (
    <section>
      <h3 className="mb-1 text-2xl font-semibold tracking-tight">
        Resultat &amp; balance
      </h3>
      <p className="mb-4 max-w-xl text-sm text-[var(--color-muted)]">
        Beløb i tusinde kroner. Δ viser ændring fra {cols[1]?.year ?? "året før"}
        {" "}til {cols[0].year}.
      </p>

      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--color-line)] text-xs text-[var(--color-muted)]">
              <th className="py-2 pl-2 text-left font-medium">Post</th>
              {cols.map((c) => (
                <th
                  key={c.year}
                  className="py-2 pr-2 text-right font-medium tabular-nums"
                >
                  {c.year}
                </th>
              ))}
              <th className="py-2 pr-2 text-right font-medium">Δ</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row, i) => {
              if (row.kind === "spacer") {
                return (
                  <tr key={`${row.label}-${i}`} className="bg-[var(--color-soft)]/40">
                    <td
                      colSpan={cols.length + 2}
                      className="py-1.5 pl-2 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]"
                    >
                      {row.label}
                    </td>
                  </tr>
                );
              }
              const field = row.field as keyof PartyFinanceYear;
              const current = (cols[0]?.data[field] as number | null) ?? null;
              const prev = (cols[1]?.data[field] as number | null) ?? null;
              const delta = pctChange(current, prev);
              const upIsGood = row.upIsGood ?? true;
              const deltaIsPositive = delta != null && delta >= 0;
              const deltaClass =
                delta == null
                  ? "text-[var(--color-muted)]"
                  : upIsGood === deltaIsPositive
                    ? "text-emerald-700"
                    : "text-rose-700";
              return (
                <tr
                  key={row.label}
                  className={
                    row.kind === "subtotal"
                      ? "border-t border-[var(--color-line)] font-semibold"
                      : ""
                  }
                >
                  <td
                    className={`py-1.5 pl-2 ${row.indent ? "pl-6 font-normal text-[var(--color-muted)]" : ""}`}
                  >
                    {row.label}
                  </td>
                  {cols.map((c) => {
                    const v = (c.data[field] as number | null) ?? null;
                    const isResultRow = field === "aaretsResultat";
                    const sign =
                      isResultRow && v != null && v > 0 ? "+" : "";
                    const colorCls =
                      isResultRow && v != null
                        ? v >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                        : "";
                    return (
                      <td
                        key={c.year}
                        className={`py-1.5 pr-2 text-right tabular-nums ${colorCls}`}
                      >
                        {sign}
                        {formatCell(v)}
                      </td>
                    );
                  })}
                  <td className={`py-1.5 pr-2 text-right tabular-nums text-xs ${deltaClass}`}>
                    {delta == null
                      ? "—"
                      : `${delta >= 0 ? "↑" : "↓"} ${Math.abs(delta).toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Income breakdown bars for the most recent year, since the table
          alone hides the relative share of each income source. */}
      <IncomeShareBars data={cols[0].data} year={cols[0].year} />
    </section>
  );
}

function IncomeShareBars({
  data,
  year,
}: {
  data: PartyFinanceYear;
  year: string;
}) {
  const total = data.indtaegterTotal;
  if (!total || total <= 0) return null;
  const sources: { label: string; value: number | null; color: string }[] = [
    { label: "Offentlig partistøtte", value: data.offentligPartistotte, color: "bg-blue-500" },
    { label: "Medlemskontingenter", value: data.medlemskontingenter, color: "bg-emerald-500" },
    { label: "Faglige org., virks., fonde", value: data.organisationer, color: "bg-amber-500" },
    { label: "Private personer", value: data.privatePersoner, color: "bg-rose-500" },
    { label: "Andre indtægter", value: data.andreIndtaegter, color: "bg-violet-500" },
  ].filter((s) => s.value != null && s.value > 0) as {
    label: string;
    value: number;
    color: string;
  }[];

  return (
    <div className="mt-6">
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
        Sammensætning af indtægter {year}
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-[var(--color-soft)]">
        {sources.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${((s.value as number) / total) * 100}%` }}
            title={`${s.label}: ${formatAmount(s.value)} (${Math.round(((s.value as number) / total) * 100)}%)`}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
        {sources.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${s.color}`} aria-hidden />
            <span className="flex-1 truncate">{s.label}</span>
            <span className="tabular-nums text-[var(--color-muted)]">
              {Math.round(((s.value as number) / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
