import Link from "next/link";
import { DemographicStats } from "@/components/DemographicStats";
import type { Government, Member, Party } from "@/lib/types";

type Props = {
  government: Government;
  members: Member[];
  parties: Party[];
  primaryCount: number;
  substituteCount: number;
  isInterim?: boolean;
};

export function GovernmentStats({
  government,
  members,
  parties,
  primaryCount,
  substituteCount,
  isInterim = false,
}: Props) {
  if (members.length === 0) return null;

  const primary = members.slice(0, primaryCount);
  const refDate = government.end ?? new Date().toISOString().slice(0, 10);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-sm font-medium uppercase tracking-wider text-[var(--color-muted)]">
          Sammensætning
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--color-muted)]">
          Folketinget har 179 sæder. I denne periode aflagde i alt{" "}
          <strong className="text-[var(--color-ink)]">{members.length}</strong>{" "}
          forskellige MF'er mindst én stemme — heraf er{" "}
          <strong className="text-[var(--color-ink)]">{primaryCount}</strong>{" "}
          de primære mandatholdere (stemte mest), og{" "}
          <strong className="text-[var(--color-ink)]">{substituteCount}</strong>{" "}
          var stedfortrædere eller MF'er der tiltrådte/forlod sædet undervejs
          (orlov, udskiftning, dødsfald, partiskifte).{" "}
          <Link
            href={`/members?gov=${government.slug}&status=all`}
            className="underline underline-offset-2 hover:text-[var(--color-ink)]"
          >
            Se hele listen og filtrer →
          </Link>
        </p>
        <p className="mt-2 max-w-3xl text-xs text-[var(--color-muted)]">
          Demografi nedenfor er beregnet på de {primaryCount} primære
          mandatholdere så stedfortrædere ikke skævvrider tallene.
        </p>
        {isInterim && (
          <p className="mt-2 max-w-3xl rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Bemærk: indtil der er afgivet stemmer i den nye samling med ny
            partikonstellation, viser partifordelingen samme MF‑sæt som ved
            slutningen af forrige regering. Tallene opdateres i takt med at
            Folketingets nye sammensætning afspejles i stemmedataene.
          </p>
        )}
      </div>

      <DemographicStats
        members={primary}
        parties={parties}
        refDate={refDate}
        ageHint={`Beregnet ${
          government.end
            ? `pr. ${government.end} (regeringens afslutning)`
            : "pr. dags dato"
        }.`}
      />
    </section>
  );
}
