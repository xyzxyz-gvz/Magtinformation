import Link from "next/link";
import { getMeta } from "@/lib/data";

export const metadata = {
  title: "Om Magtinformation",
  description:
    "Om projektet, metoden bag tallene, dataopdatering og privatliv.",
};

function formatDate(d: string | null) {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString("da-DK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function OmPage() {
  const meta = await getMeta();
  const updated = formatDate(meta.updated_at);

  return (
    <article className="prose-like space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Om Magtinformation
        </h1>
        <p className="mt-3 max-w-3xl text-[var(--color-muted)]">
          Magtinformation er et uafhængigt sideprojekt der gør Folketingets
          åbne afstemningsdata mere navigerbart. Alt det du ser her — talene,
          listerne, fordelingerne — er udledt af{" "}
          <a
            href="https://oda.ft.dk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            oda.ft.dk
          </a>
          , Folketingets officielle åbne data‑API. Sitet er ikke tilknyttet
          Folketinget eller Folketingets administration.
        </p>
        {updated && (
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            Data senest hentet og forarbejdet:{" "}
            <strong className="text-[var(--color-ink)]">{updated}</strong>.
          </p>
        )}
      </header>

      <Section
        id="metode"
        title="Metode"
        intro="De fleste tal du ser er ikke direkte fra Folketinget — de er beregnet ud fra rådata. Her er hvordan."
      >
        <Method
          term="Fremmøde"
          def={
            <>
              Andelen af afstemninger hvor MF'en aflagde en stemme (For, Imod
              eller Hverken for eller imod). Fravær — også når det skyldes en{" "}
              <Link href="/#clearing" className="underline underline-offset-2">
                clearingsaftale
              </Link>{" "}
              — tæller som ikke‑mødt. Beregnes på alle afstemninger MF'en har
              været del af stemmeprotokollen for.
            </>
          }
        />
        <Method
          term="Afvigelse fra eget parti"
          def="Andelen af afgivne stemmer (fravær udeladt) hvor MF'en stemte imod sit partis flertal på samme afstemning. Hvis halvdelen af partiet var fraværende og resten var splittet, kan en enkelt MF stå opført som “afvigelse” mod et meget tyndt flertal — det skævvrider tallet en smule for små eller fragmenterede partier."
        />
        <Method
          term="Partienhed"
          def="Andelen af afstemninger hvor partiets flertal stemte entydigt (For, Imod eller Hverken). Når flertallet ikke kan afgøres entydigt — fx hvis lige mange stemte for og imod — tæller den afstemning ikke med."
        />
        <Method
          term="Primær mandatholder vs. stedfortræder"
          def={
            <>
              Folketinget har 179 sæder, men over en regerings 4 år får mange
              sæder besøg af stedfortrædere (orlov, barsel, ministerudpegning)
              eller bliver overdraget mellem MF'er. Vi tæller alle der stemte
              i perioden, men vi sorterer dem efter antal afgivne stemmer:
              de 179 mest aktive kalder vi <em>primære mandatholdere</em>.
              Demografi pr. regering beregnes på de 179 — så stedfortrædere
              ikke skævvrider tal som gennemsnitsalder eller kønsfordeling.
            </>
          }
        />
        <Method
          term="Agreement‑matrix mellem partier"
          def="To partier scorer agreement = 1.0 hvis deres flertal stemte ens i alle delte afstemninger, og 0.0 hvis altid modsat. Hverken‑stemmer tæller som tredje kategori. Kun afstemninger hvor begge partier havde et entydigt flertal indgår — derfor er totalerne lidt lavere end det samlede antal afstemninger."
        />
        <Method
          term="Demografi (køn, alder, uddannelse)"
          def="Trækkes direkte fra Folketingets CV‑felter (sex, born, educationStatistic) i hver MF's biografi. Coverage varierer for ældre MF'er — vi viser altid hvor stor en andel af gruppen vi har data på i procent."
        />
        <Method
          term="Partihistorik / partiskiftere"
          def="Bygges fra aktørrelationer (rolle = medlem) mellem person og folketingsgruppe. Sammenhængende perioder i samme gruppe slås sammen, så et partis omdøbning (fx 'Det Radikale Venstre' → 'Radikale Venstre') ikke fejlagtigt tæller som et partiskifte."
        />
        <Method
          term="Tætteste afstemninger"
          def="Procenten | for − imod | / (for + imod). Procedure‑afstemninger med under 80 stemmer er udeladt for at undgå støj fra delvist afholdte afstemninger."
        />
      </Section>

      <Section
        id="caveats"
        title="Hvad du skal være opmærksom på"
      >
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed">
          <li>
            <strong>Afledte tal</strong> — fremmøde, afvigelse, partienhed,
            agreement — er beregnet af os. Folketinget offentliggør ikke selv
            disse direkte. Hvis et tal virker overraskende, så kig først på
            metoden ovenfor.
          </li>
          <li>
            <strong>Fravær er ikke nødvendigvis pjækkeri.</strong> Mange MF'er
            er parret op via clearingsaftaler så magtbalancen ikke flyttes.{" "}
            <Link href="/#clearing" className="underline underline-offset-2">
              Læs mere
            </Link>
            .
          </li>
          <li>
            <strong>Datasættet kan være forsinket.</strong> oda.ft.dk
            opdateres med korte intervaller, men vi henter typisk data en
            gang i døgnet. Helt nye afstemninger kan derfor mangle her selv
            om de er afsluttet på Christiansborg.
          </li>
          <li>
            <strong>Brug det som udgangspunkt — ikke som facit.</strong> Hvis
            du citerer et tal offentligt, så verificér det gerne mod{" "}
            <a
              href="https://www.ft.dk"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              ft.dk
            </a>{" "}
            først.
          </li>
        </ul>
      </Section>

      <Section id="privatliv" title="Privatliv og cookies">
        <p className="text-sm leading-relaxed">
          Magtinformation har <strong>ingen analytics, ingen tracking og
          ingen cookies fra tredjepart</strong>. Vi sætter heller ikke selv
          cookies. Den eneste lokale lagring der finder sted, er en
          markering i din browsers <code>localStorage</code> om at du har
          set forsidens disclaimer — så du ikke bliver mødt af modalen ved
          hvert besøg. Den nøgle hedder{" "}
          <code>magtinformation:disclaimer-accepted-v1</code> og kan slettes
          når som helst i dine browserindstillinger.
        </p>
        <p className="mt-3 text-sm leading-relaxed">
          Da vi ikke gemmer brugbare oplysninger om dig, har vi heller intet
          at udlevere på anmodning. Serverlogs hos hostingudbyderen kan
          midlertidigt indeholde IP‑adresser men bruges udelukkende til
          drift og sikkerhed.
        </p>
      </Section>

      <Section id="data" title="Data og kildekode">
        <p className="text-sm leading-relaxed">
          Rådata kommer fra{" "}
          <a
            href="https://oda.ft.dk"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            oda.ft.dk
          </a>{" "}
          og bearbejdes af en pipeline der ligger sammen med sitet. Pipeline'en
          står for at samle stemmeprotokoller, knytte dem til sager,
          ekstrahere CV‑felter fra biografier osv. — alt det der gør de
          afledte tal mulige. Hvis du finder en fejl, en uklar formulering
          eller en udregning der ikke holder, hører vi gerne om det.
        </p>
      </Section>
    </article>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {intro && (
        <p className="max-w-3xl text-sm text-[var(--color-muted)]">{intro}</p>
      )}
      <div className="max-w-3xl">{children}</div>
    </section>
  );
}

function Method({
  term,
  def,
}: {
  term: string;
  def: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--color-line)] py-3 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{term}</h3>
      <div className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">
        {def}
      </div>
    </div>
  );
}
