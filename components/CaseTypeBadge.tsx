/**
 * Visual badge for what KIND of forslag a vote belongs to.
 * Reliable signal is caseNummer prefix (L / B / V), with the title scanned
 * for "borgerforslag" so citizen-initiated proposals stand out — Folketinget
 * categorises those as Beslutningsforslag, but they're politically distinct.
 */

export type CaseKind =
  | "Lovforslag"
  | "Borgerforslag"
  | "Beslutningsforslag"
  | "Forslag til vedtagelse"
  | "Andet";

const STYLES: Record<CaseKind, { dot: string; text: string; bg: string }> = {
  Lovforslag: { dot: "#2563eb", text: "text-blue-800", bg: "bg-blue-50" },
  Borgerforslag: { dot: "#d97706", text: "text-amber-800", bg: "bg-amber-50" },
  Beslutningsforslag: {
    dot: "#7c3aed",
    text: "text-violet-800",
    bg: "bg-violet-50",
  },
  "Forslag til vedtagelse": {
    dot: "#0d9488",
    text: "text-teal-800",
    bg: "bg-teal-50",
  },
  Andet: { dot: "#6b7280", text: "text-gray-700", bg: "bg-gray-50" },
};

const SHORT: Record<CaseKind, string> = {
  Lovforslag: "L",
  Borgerforslag: "Borgerforslag",
  Beslutningsforslag: "B",
  "Forslag til vedtagelse": "V",
  Andet: "?",
};

const TOOLTIPS: Record<CaseKind, string> = {
  Lovforslag:
    "Lovforslag — bliver til lov hvis vedtaget. Kan stilles af regering eller folketingsmedlemmer.",
  Borgerforslag:
    "Borgerforslag — forslag rejst af borgere via borgerforslag.dk. Behandles som beslutningsforslag.",
  Beslutningsforslag:
    "Beslutningsforslag — politisk pålæg til regeringen. Bliver ikke selv til lov.",
  "Forslag til vedtagelse":
    "Forslag til vedtagelse — Folketingets stillingtagen, ofte i forbindelse med en debat.",
  Andet: "Andet eller ukendt sagstype.",
};

export function classifyCase(
  caseNummer: string | null | undefined,
  caseTitel: string | null | undefined,
): CaseKind {
  const title = (caseTitel ?? "").toLowerCase();
  if (title.includes("borgerforslag")) return "Borgerforslag";
  const prefix = (caseNummer ?? "").trim().split(/\s+/)[0]?.toUpperCase();
  if (prefix === "L") return "Lovforslag";
  if (prefix === "B") return "Beslutningsforslag";
  if (prefix === "V") return "Forslag til vedtagelse";
  // Fallback: check title patterns for cases where caseNummer is empty
  if (title.startsWith("forslag til lov ")) return "Lovforslag";
  if (title.startsWith("forslag til folketingsbeslutning"))
    return "Beslutningsforslag";
  if (title.startsWith("forslag til vedtagelse")) return "Forslag til vedtagelse";
  return "Andet";
}

type Props = {
  caseNummer?: string | null;
  caseTitel?: string | null;
  size?: "sm" | "md";
};

export function CaseTypeBadge({ caseNummer, caseTitel, size = "sm" }: Props) {
  const kind = classifyCase(caseNummer, caseTitel);
  const style = STYLES[kind];
  const label = SHORT[kind];
  const fullLabel = kind === "Borgerforslag" ? "Borgerforslag" : kind;
  const sizing =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5"
      : "text-xs px-2 py-0.5";
  return (
    <span
      title={`${fullLabel} — ${TOOLTIPS[kind]}`}
      className={`inline-flex items-center gap-1 rounded-full font-medium ${style.bg} ${style.text} ${sizing}`}
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: style.dot }}
      />
      {kind === "Borgerforslag" || size === "md" ? fullLabel : label}
    </span>
  );
}
