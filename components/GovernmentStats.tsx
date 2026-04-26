import Link from "next/link";
import { DemographicStats } from "@/components/DemographicStats";
import type { Government, Member, Party } from "@/lib/types";

type Props = {
  government: Government;
  members: Member[];
  parties: Party[];
  primaryCount: number;
  substituteCount: number;
};

export function GovernmentStats({
  government,
  members,
  parties,
  primaryCount,
  substituteCount,
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
