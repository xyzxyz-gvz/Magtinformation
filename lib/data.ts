import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";
import type {
  Ally,
  CaseSummary,
  EnrichedVote,
  Government,
  Member,
  MemberPartyHistory,
  MemberProfile,
  MemberVote,
  Party,
  PartyAgreement,
  Vote,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

async function readJSON<T>(file: string, fallback: T): Promise<T> {
  try {
    const txt = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    return JSON.parse(txt) as T;
  } catch {
    return fallback;
  }
}

export const getGovernments = cache(
  (): Promise<Government[]> => readJSON("governments.json", []),
);

export const getParties = cache(
  (): Promise<Party[]> => readJSON("parties.json", []),
);

export const getMembers = cache(
  (): Promise<Member[]> => readJSON("members_processed.json", []),
);

export const getMemberProfiles = cache(
  (): Promise<MemberProfile[]> => readJSON("member_profiles.json", []),
);

export const getAllies = cache(
  (): Promise<Record<string, Ally[]>> =>
    readJSON("member_allies.json", {} as Record<string, Ally[]>),
);

export const getPartyAgreement = cache(
  (): Promise<PartyAgreement | null> =>
    readJSON<PartyAgreement | null>("party_agreement.json", null),
);

export const getVoteMajorities = cache(
  (): Promise<Record<string, Record<string, number>>> =>
    readJSON("vote_party_majorities.json", {} as Record<string, Record<string, number>>),
);

export const getVotesList = cache(
  (): Promise<Vote[]> => readJSON("votes_list.json", []),
);

export const getEnrichedVotes = cache(
  (): Promise<EnrichedVote[]> => readJSON("votes_enriched.json", []),
);

export const getMemberVotes = cache(
  async (id: number): Promise<MemberVote[]> => {
    try {
      const txt = await fs.readFile(
        path.join(DATA_DIR, "member_votes", `${id}.json`),
        "utf-8",
      );
      return JSON.parse(txt) as MemberVote[];
    } catch {
      return [];
    }
  },
);

export const getMember = cache(async (id: number): Promise<Member | null> => {
  const all = await getMembers();
  return all.find((m) => m.id === id) ?? null;
});

export const getMemberProfile = cache(
  async (id: number): Promise<MemberProfile | null> => {
    const all = await getMemberProfiles();
    return all.find((p) => p.id === id) ?? null;
  },
);

export const getMemberAllies = cache(
  async (id: number): Promise<Ally[]> => {
    const all = await getAllies();
    return all[String(id)] ?? [];
  },
);

export const getVote = cache(async (id: number): Promise<Vote | null> => {
  const all = await getVotesList();
  return all.find((v) => v.id === id) ?? null;
});

export const getEnrichedVote = cache(
  async (id: number): Promise<EnrichedVote | null> => {
    const all = await getEnrichedVotes();
    return all.find((v) => v.id === id) ?? null;
  },
);

export const getCaseSummaries = cache(
  (): Promise<Record<string, CaseSummary>> =>
    readJSON("case_summaries.json", {} as Record<string, CaseSummary>),
);

export const getCaseSummary = cache(
  async (sagstrinid: number | null): Promise<CaseSummary | null> => {
    if (!sagstrinid) return null;
    const all = await getCaseSummaries();
    return all[String(sagstrinid)] ?? null;
  },
);

export const getVoteTopics = cache(
  (): Promise<Record<string, string[]>> =>
    readJSON("vote_topics.json", {} as Record<string, string[]>),
);

export type CaseTimelineStep = {
  id: number;
  titel: string | null;
  dato: string | null;
  typeid: number | null;
};

export const getCaseTimelines = cache(
  (): Promise<Record<string, CaseTimelineStep[]>> =>
    readJSON(
      "case_timelines.json",
      {} as Record<string, CaseTimelineStep[]>,
    ),
);

export const getCaseTimeline = cache(
  async (sagid: number | null): Promise<CaseTimelineStep[]> => {
    if (!sagid) return [];
    const all = await getCaseTimelines();
    return all[String(sagid)] ?? [];
  },
);

export type Meta = {
  updated_at: string | null;
  sources?: string[];
};

export const getMeta = cache(
  (): Promise<Meta> =>
    readJSON("meta.json", { updated_at: null } as Meta),
);

export const getMemberPartyHistory = cache(
  (): Promise<Record<string, MemberPartyHistory>> =>
    readJSON(
      "member_party_history.json",
      {} as Record<string, MemberPartyHistory>,
    ),
);

export type GovernmentMemberEntry = { id: number; votes: number };

export const getGovernmentMembers = cache(
  (): Promise<Record<string, GovernmentMemberEntry[]>> =>
    readJSON(
      "government_members.json",
      {} as Record<string, GovernmentMemberEntry[]>,
    ),
);
