import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";
import { MembersFilter } from "@/components/MembersFilter";
import { PartyBadge } from "@/components/PartyBadge";
import {
  getGovernmentMembers,
  getGovernments,
  getMembers,
  getParties,
} from "@/lib/data";
import type { Member } from "@/lib/types";

const PAGE_SIZE = 25;

const EDU_LABEL: Record<string, string> = {
  LVU: "LVU",
  MVU: "MVU",
  KVU: "KVU",
  Erhvervsfaglig: "Erhvervsfaglig",
  Gymnasial: "Gymnasial",
  Grundskole: "Grundskole",
};

function ageAt(born: string | null, refDate: string): number | null {
  if (!born) return null;
  const b = new Date(born);
  const r = new Date(refDate);
  if (isNaN(b.getTime()) || isNaN(r.getTime())) return null;
  let age = r.getFullYear() - b.getFullYear();
  const m = r.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && r.getDate() < b.getDate())) age--;
  return age;
}

export default async function MembersIndex({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const party = sp.party ?? "";
  const status = sp.status ?? "current";
  const sex = sp.sex ?? "";
  const education = sp.education ?? "";
  const gov = sp.gov ?? "";
  const sort = sp.sort ?? "name";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  // Legacy alias
  const currentMFLegacy = sp.currentMF;
  const effectiveStatus =
    currentMFLegacy === "1" ? "current" : currentMFLegacy === "0" ? "former" : status;

  const [members, parties, governments, govMembersMap] = await Promise.all([
    getMembers(),
    getParties(),
    getGovernments(),
    getGovernmentMembers(),
  ]);

  const partyByShort = new Map(parties.map((p) => [p.short, p]));
  const refDate = new Date().toISOString().slice(0, 10);

  const govMemberSet = gov ? new Set((govMembersMap[gov] ?? []).map((r) => r.id)) : null;

  const needle = q.toLowerCase();
  let filtered = members.filter((m) => {
    if (effectiveStatus === "current" && !m.isCurrentMF) return false;
    if (effectiveStatus === "former" && m.isCurrentMF) return false;
    if (party && m.partyShort !== party) return false;
    if (sex && m.sex !== sex) return false;
    if (education && m.educationStatistic !== education) return false;
    if (govMemberSet && !govMemberSet.has(m.id)) return false;
    if (needle && !m.navn.toLowerCase().includes(needle)) return false;
    return true;
  });

  filtered = sortMembers(filtered, sort, refDate);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const slice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const qsLink = (overrides: Record<string, string>) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (party) params.set("party", party);
    if (effectiveStatus !== "current") params.set("status", effectiveStatus);
    if (sex) params.set("sex", sex);
    if (education) params.set("education", education);
    if (gov) params.set("gov", gov);
    if (sort !== "name") params.set("sort", sort);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    const s = params.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Medlemmer</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">
            {total.toLocaleString("da-DK")} resultat
            {total === 1 ? "" : "er"} · {members.length.toLocaleString("da-DK")}{" "}
            MF'er i alt i datasættet
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/members?sort=deviation&status=current"
            className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs no-underline hover:bg-[var(--color-soft)] hover:no-underline"
          >
            Oprørere
          </Link>
          <Link
            href="/members/sammenlign"
            className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs no-underline hover:bg-[var(--color-soft)] hover:no-underline"
          >
            Sammenlign to MF'er
          </Link>
        </div>
      </div>

      <MembersFilter
        parties={parties}
        governments={governments}
        q={q}
        party={party}
        status={effectiveStatus}
        sex={sex}
        education={education}
        gov={gov}
        sort={sort}
      />

      {slice.length === 0 ? (
        <EmptyState
          title="Ingen MF'er matcher filtrene"
          body="Prøv at fjerne et af filtrene — fx ved at skifte status til 'Alle (begge)' eller nulstille søgningen."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
          {slice.map((m) => {
            const p = partyByShort.get(m.partyShort);
            const age = ageAt(m.born, refDate);
            return (
              <li key={m.id}>
                <Link
                  href={`/members/${m.id}`}
                  className="flex items-center gap-3 py-2 hover:bg-[var(--color-soft)]"
                >
                  {m.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.photo}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full border border-[var(--color-line)] object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--color-line)] bg-[var(--color-soft)] text-xs text-[var(--color-muted)]">
                      —
                    </div>
                  )}
                  <PartyBadge party={p} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium">{m.navn}</span>
                      {!m.isCurrentMF && (
                        <span className="text-xs text-[var(--color-muted)]">
                          tidl.
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--color-muted)]">
                      <span>{p?.navn ?? m.partyShort}</span>
                      {m.sex && (
                        <>
                          <span>·</span>
                          <span>{m.sex}</span>
                        </>
                      )}
                      {age != null && (
                        <>
                          <span>·</span>
                          <span>{age} år</span>
                        </>
                      )}
                      {m.educationStatistic && (
                        <>
                          <span>·</span>
                          <span>
                            {EDU_LABEL[m.educationStatistic] ??
                              m.educationStatistic}
                          </span>
                        </>
                      )}
                      {m.constituency && (
                        <>
                          <span>·</span>
                          <span className="truncate">{m.constituency}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs tabular-nums text-[var(--color-muted)] sm:block">
                    {m.fremmødePct != null && (
                      <div>fremmøde {m.fremmødePct}%</div>
                    )}
                    {m.afvigelsePct != null && (
                      <div>afviger {m.afvigelsePct}%</div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Link
            aria-disabled={safePage <= 1}
            className={
              safePage <= 1
                ? "pointer-events-none text-[var(--color-muted)]"
                : "text-[var(--color-ink)]"
            }
            href={`/members${qsLink({ page: String(safePage - 1) })}`}
          >
            ← Forrige
          </Link>
          <div className="text-[var(--color-muted)]">
            Side {safePage} af {totalPages.toLocaleString("da-DK")}
          </div>
          <Link
            aria-disabled={safePage >= totalPages}
            className={
              safePage >= totalPages
                ? "pointer-events-none text-[var(--color-muted)]"
                : "text-[var(--color-ink)]"
            }
            href={`/members${qsLink({ page: String(safePage + 1) })}`}
          >
            Næste →
          </Link>
        </div>
      )}
    </div>
  );
}

function sortMembers(list: Member[], sort: string, refDate: string): Member[] {
  const copy = [...list];
  switch (sort) {
    case "party":
      copy.sort(
        (a, b) =>
          a.partyOrder - b.partyOrder ||
          (a.efternavn ?? "").localeCompare(b.efternavn ?? "", "da"),
      );
      break;
    case "age": {
      copy.sort((a, b) => {
        const aa = ageAt(a.born, refDate);
        const ab = ageAt(b.born, refDate);
        if (aa == null && ab == null) return 0;
        if (aa == null) return 1;
        if (ab == null) return -1;
        return aa - ab;
      });
      break;
    }
    case "ageDesc": {
      copy.sort((a, b) => {
        const aa = ageAt(a.born, refDate);
        const ab = ageAt(b.born, refDate);
        if (aa == null && ab == null) return 0;
        if (aa == null) return 1;
        if (ab == null) return -1;
        return ab - aa;
      });
      break;
    }
    case "attendance":
      copy.sort((a, b) => (a.fremmødePct ?? 999) - (b.fremmødePct ?? 999));
      break;
    case "attendanceDesc":
      copy.sort((a, b) => (b.fremmødePct ?? -1) - (a.fremmødePct ?? -1));
      break;
    case "deviation":
      copy.sort((a, b) => (b.afvigelsePct ?? -1) - (a.afvigelsePct ?? -1));
      break;
    case "name":
    default:
      copy.sort((a, b) =>
        (a.efternavn ?? a.navn).localeCompare(b.efternavn ?? b.navn, "da"),
      );
  }
  return copy;
}
