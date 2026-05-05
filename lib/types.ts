export type Party = {
  short: string;
  letter: string;
  navn: string;
  color: string;
  left_order: number;
};

export type Government = {
  slug: string;
  name: string;
  type: string;
  start: string;
  end: string | null;
  parties: string[];
  description: string;
};

export type Member = {
  id: number;
  navn: string;
  fornavn: string | null;
  efternavn: string | null;
  partyShort: string;
  partyColor: string;
  partyOrder: number;
  photo: string | null;
  constituency: string | null;
  profession: string | null;
  url: string | null;
  startdato: string | null;
  slutdato: string | null;
  isCurrentMF: boolean;
  fremmødePct: number | null;
  afvigelsePct: number | null;
  afstemningerTotal: number;
  firstVoteDate: string | null;
  lastVoteDate: string | null;
  tags: string[];
  sex: string | null;
  born: string | null;
  educationStatistic: string | null;
  occupationStatistic: string | null;
};

export type CV = {
  born?: string | null;
  sex?: string | null;
  personalInfo?: string | null;
  educations?: string[];
  ministers?: string[];
  constituencies?: string[];
  nominations?: string[];
  positionsOfTrust?: string[];
  occupations?: string[];
  parliamentaryPositions?: string[];
  website?: string | null;
  facebook?: string | null;
  twitter?: string | null;
};

export type Committee = {
  navn: string;
  short: string | null;
  typeid: number;
  typeName: string;
  role: string;
  startdato: string | null;
  isCurrent: boolean;
};

export type CaseRole = {
  sagid: number;
  titel: string | null;
  nummer: string | null;
  rolle: string;
  dato: string | null;
};

export type MemberProfile = {
  id: number;
  cv: CV;
  committees: Committee[];
  caseRoles: CaseRole[];
  recentMeetings: unknown[];
};

export type Ally = {
  id: number;
  navn: string;
  party: string;
  agreement: number;
  shared: number;
};

export type Vote = {
  id: number;
  nummer: string | null;
  vedtaget: boolean;
  typeid: number;
  type: string | null;
  dato: string;
  sagstrinid: number | null;
  konklusion: string | null;
  kommentar: string | null;
  forCount: number;
  imodCount: number;
  fraværCount: number;
  hverkenCount: number;
  caseTitel: string | null;
  caseNummer: string | null;
  caseUrl: string | null;
  topics?: string[];
};

export type Stemme = {
  aktørid: number;
  typeid: number;
};

export type EnrichedVote = Vote & {
  mødeid: number | null;
  stemmer: Stemme[];
};

export type MemberVote = {
  id: number;
  t: number;
  d: string;
  v: boolean;
  ct: string | null;
  cn: string | null;
  nr: string | null;
  dev: boolean;
};

export const VOTE_LABELS: Record<number, string> = {
  1: "For",
  2: "Imod",
  3: "Fravær",
  4: "Hverken",
};

export const VOTE_COLORS: Record<number, string> = {
  1: "#16a34a",
  2: "#dc2626",
  3: "#9ca3af",
  4: "#eab308",
};

export type PartyAgreement = {
  parties: string[];
  matrix: (number | null)[][];
  shared: number[][];
};

export type PartyFinanceDonor = {
  name: string;
  /** company / union / association / fund / person */
  type: "company" | "union" | "association" | "fund" | "person";
  /** How the donation was given. Optional for backwards-compat with older
   *  records; missing values are displayed as plain "monetary". */
  kind?: "monetary" | "in_kind" | "partiskat";
  /** Stated value in t.kr. — rarely available except for in-kind
   *  donations where the party puts a number on it. */
  amount?: number | null;
  /** Free-form qualifier ("mødefaciliteter", "lokaler", etc.) */
  note?: string | null;
};

export type PartyFinanceYear = {
  /** All amounts are in 1.000 DKK (t.kr.) as published. */
  offentligPartistotte: number | null;
  medlemskontingenter: number | null;
  privatePersoner: number | null;
  organisationer: number | null;
  andreIndtaegter: number | null;
  indtaegterTotal: number | null;
  udgifterTotal: number | null;
  aaretsResultat: number | null;
  egenkapital: number | null;
  anonymeTilskud: number | null;
  donors: PartyFinanceDonor[];
};

export type PartyFinanceMeta = {
  source: string;
  url: string;
  currency: string;
  unit: string;
  note: string;
};

/** Map of partyShort → year → finance data. The "_meta" key holds source info. */
export type PartyFinancesFile = Record<
  string,
  Record<string, PartyFinanceYear> | PartyFinanceMeta
>;

export type PartyTimelineEntry = {
  partyShort: string;
  partyName: string;
  start: string | null;
  end: string | null;
};

export type MemberPartyHistory = {
  timeline: PartyTimelineEntry[];
  distinctParties: string[];
  switched: boolean;
};

export type CaseSummary = {
  sagid: number;
  titelkort: string | null;
  resume: string | null;
  afstemningskonklusion: string | null;
  baggrundsmateriale: string | null;
  retsinformationsurl: string | null;
  lovnummer: string | null;
  lovnummerdato: string | null;
  sagsstatus: string | null;
  sagstype: string | null;
  sagskategori: string | null;
  stepTitel: string | null;
  stepDato: string | null;
};
