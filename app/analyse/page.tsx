import Link from "next/link";

export const metadata = {
  title: "Analyse — Magtinformation",
};

const ANALYSES = [
  {
    href: "/analyse/koalitioner",
    title: "Koalitioner",
    body: "Hvor enige er partierne reelt? Matrice over hvor ofte hvert par stemmer ens.",
  },
  {
    href: "/analyse/afstemninger",
    title: "Tætteste og mest enige afstemninger",
    body: "De afstemninger hvor en håndfuld stemmer kunne have vendt resultatet — og dem hvor Folketinget stemte næsten enstemmigt.",
  },
  {
    href: "/partiskiftere",
    title: "Partiskiftere",
    body: "MF'er der har siddet for mere end én folketingsgruppe — med komplet tidslinje pr. person.",
  },
  {
    href: "/members/sammenlign",
    title: "Sammenlign to MF'er",
    body: "Stil to medlemmer side om side: enighed, demografi og en liste over de afstemninger de stemte forskelligt om.",
  },
  {
    href: "/topics",
    title: "Emner",
    body: "Bladr i alle emneord. Hver emneside viser partiernes stemmemønster på lige præcis det område.",
  },
];

export default function AnalyseHub() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analyse</h1>
        <p className="mt-3 max-w-2xl text-[var(--color-muted)]">
          Sider der dykker ned i mønstre på tværs af afstemninger, partier og
          MF'er. De arbejder alle på samme datasæt fra oda.ft.dk.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {ANALYSES.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="flex h-full flex-col rounded-lg border border-[var(--color-line)] p-4 hover:bg-[var(--color-soft)]"
            >
              <h2 className="text-base font-medium">{a.title}</h2>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{a.body}</p>
              <span className="mt-3 text-xs text-[var(--color-ink)] underline underline-offset-2">
                Åbn →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
