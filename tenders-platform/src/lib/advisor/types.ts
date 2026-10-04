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

/** Въпрос от анкетата. `multi` — може да се изберат няколко отговора. */
export type AdvisorQuestion = {
  id: string;
  topic: string;
  text: string;
  options: string[];
  multi: boolean;
  /** „общи“, „обществени поръчки“ или „европейски програми“. */
  track?: string;
  /** Защо питаме — показва се под въпроса. */
  why?: string;
};
export type AdvisorAnswer = { question: string; answer: string };

/** Какво AI е разбрало за фирмата (стъпка 1). */
export type AdvisorProfile = {
  summary: string;
  fitAreas: { title: string; why: string }[];
  /** Какви европейски пари могат да търсят — „за развитие“. */
  growthAreas: { title: string; why: string }[];
  /** Анкетата — генерира се веднъж, от описанието. */
  questions: AdvisorQuestion[];
  /** false — анкетата още не е попълнена и подборът не е правен. */
  surveyDone?: boolean;
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

/** Профили от първата версия нямат id/topic/multi на въпросите. */
export function normalizeQuestions(questions: Partial<AdvisorQuestion>[] | undefined): AdvisorQuestion[] {
  return (questions ?? []).map((q, i) => ({
    id: q.id ?? `q${i + 1}`,
    topic: q.topic ?? "",
    text: q.text ?? "",
    options: q.options ?? [],
    multi: q.multi ?? false,
    track: q.track,
    why: q.why,
  }));
}
