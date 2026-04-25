import type { Government } from "./types";

export function getGovernmentForDate(
  governments: Government[],
  date: string | null | undefined,
): Government | null {
  if (!date) return null;
  for (const g of governments) {
    if (date >= g.start && (g.end === null || date < g.end)) {
      return g;
    }
  }
  return null;
}

export function formatDateRange(g: Government): string {
  const fmt = (d: string) => {
    const [y, m] = d.split("-");
    const months = [
      "jan", "feb", "mar", "apr", "maj", "jun",
      "jul", "aug", "sep", "okt", "nov", "dec",
    ];
    return `${months[Number(m) - 1]}. ${y}`;
  };
  const start = fmt(g.start);
  const end = g.end ? fmt(g.end) : "nu";
  return `${start} – ${end}`;
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
