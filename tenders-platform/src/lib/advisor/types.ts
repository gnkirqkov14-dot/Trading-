/**
 * Типовете на съветника отделно от логиката: ползват ги и клиентските
 * компоненти, а те не бива да внасят SDK-то на Anthropic в браузъра.
 */

export type AdvisorFilters = {
  /** Какво да търси: обществени поръчки, европейски програми или и двете. */
  tenders: boolean;
  grants: boolean;
  cpvPrefixes: string[];
  keywords: string[];
  regions: string[];
  minValue?: number;
  maxValue?: number;
};

export type AdvisorQuestion = { text: string; options: string[] };
export type AdvisorAnswer = { question: string; answer: string };

/** Какво AI е разбрало за фирмата (стъпка 1). */
export type AdvisorProfile = {
  summary: string;
  fitAreas: { title: string; why: string }[];
  /** Какви европейски пари могат да търсят — „за развитие“. */
  growthAreas: { title: string; why: string }[];
  questions: AdvisorQuestion[];
};

export type TenderPick = { id: number; fit: "high" | "medium"; why: string; check: string[] };
export type GrantPick = { id: string; fit: "high" | "medium"; why: string; prepare: string[] };

export type AdvisorResults = {
  tenders: TenderPick[];
  tendersNote: string | null;
  grants: GrantPick[];
  grantsNote: string | null;
};

/** Запазеният профил (tenders.company_profiles). */
export type SavedProfile = {
  token: string;
  description: string;
  answers: AdvisorAnswer[];
  profile: AdvisorProfile;
  filters: AdvisorFilters;
  results: AdvisorResults;
  last_run_at: string | null;
  updated_at?: string;
};

export const EMPTY_RESULTS: AdvisorResults = { tenders: [], tendersNote: null, grants: [], grantsNote: null };
