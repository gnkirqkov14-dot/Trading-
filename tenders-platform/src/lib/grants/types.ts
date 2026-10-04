/** Една процедура за безвъзмездна помощ, както я пазим (tenders.grant_calls). */
export type GrantCall = {
  id: string;
  kind: "open" | "discussion" | "planned";
  source: string;
  code: string | null;
  title: string;
  programme: string | null;
  url: string | null;
  doc_url: string | null;
  /** Дата на отваряне; при `planned` — първо число на планирания месец. */
  opens_at: string | null;
  deadline_at: string | null;
  summary: string | null;
  applicants: string | null;
  applicant_types: string[];
  for_business: boolean | null;
  budget_eur: number | null;
  grant_min_eur: number | null;
  grant_max_eur: number | null;
  max_aid_pct: number | null;
  activities: string | null;
  costs: string | null;
  prepare: string | null;
  source_hash: string | null;
  enriched_at: string | null;
  is_active?: boolean;
  updated_at?: string;
};

export type GrantKnown = { id: string; source_hash: string | null; enriched: boolean };
