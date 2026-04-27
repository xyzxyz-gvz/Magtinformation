"use client";

import Link from "next/link";
import { useMemo } from "react";
import { PartyBadge } from "@/components/PartyBadge";
import type { Party } from "@/lib/types";

export type MeetMember = {
  id: number;
  navn: string;
  fornavn: string | null;
  efternavn: string | null;
  partyShort: string;
  photo: string | null;
};

type Props = {
  members: MeetMember[];
  parties: Party[];
  /** Seconds to scroll the entire roster across the screen. */
  durationSec?: number;
};

const DEFAULT_DURATION = 360;

export function MeetFolketinget({
  members,
  parties,
  durationSec = DEFAULT_DURATION,
}: Props) {
  const partyByShort = useMemo(
    () => new Map(parties.map((p) => [p.short, p])),
    [parties],
  );

  // Light shuffle once on mount so reloads aren't identical, then duplicate
  // the list so the marquee can wrap seamlessly.
  const ordered = useMemo(() => {
    if (members.length === 0) return members;
    const seed =
      typeof window === "undefined"
        ? 0
        : Math.floor((Date.now() / 60000) % 1_000_000);
    const out = members.map((m) => ({
      m,
      k: ((m.id * 2654435761) ^ seed) >>> 0,
    }));
    out.sort((a, b) => a.k - b.k);
    return out.map((x) => x.m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members.length]);

  if (ordered.length === 0) return null;

  // Render twice so a translateX of -50% loops seamlessly.
  const doubled = [...ordered, ...ordered];

  return (
    <div
      className="group relative -mx-6 overflow-hidden"
      aria-label={`Et kontinuerligt bladrende hjul over ${ordered.length} folketingsmedlemmer`}
    >
        {/* Edge fades so cards drift in/out softly */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[var(--color-paper)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[var(--color-paper)] to-transparent" />

        <ul
          className="flex w-max gap-3 px-6 motion-safe:animate-[marquee_var(--mf-duration)_linear_infinite] motion-safe:group-hover:[animation-play-state:paused]"
          style={
            {
              "--mf-duration": `${durationSec}s`,
            } as React.CSSProperties
          }
        >
          {doubled.map((m, i) => {
            const p = partyByShort.get(m.partyShort);
            return (
              <li key={`${i}-${m.id}`} className="w-32 shrink-0">
                <Link
                  href={`/members/${m.id}`}
                  className="block rounded-lg border border-[var(--color-line)] p-2 text-center no-underline hover:bg-[var(--color-soft)] hover:no-underline"
                >
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo}
                      alt=""
                      loading="lazy"
                      className="mx-auto aspect-square h-20 w-20 rounded-full border border-[var(--color-line)] object-cover"
                    />
                  ) : (
                    <div className="mx-auto h-20 w-20 rounded-full border border-dashed border-[var(--color-line)] bg-[var(--color-soft)]" />
                  )}
                  <div className="mt-2 truncate text-xs font-medium">
                    {m.fornavn
                      ? `${m.fornavn} ${m.efternavn ?? ""}`.trim()
                      : m.navn}
                  </div>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px] text-[var(--color-muted)]">
                    <PartyBadge party={p} size="sm" />
                    <span className="truncate">{p?.short ?? m.partyShort}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
  );
}
