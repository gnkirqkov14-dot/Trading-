import type { SearchResult, Tender, TenderFilters } from "@/lib/eop/types";

export type AlertSubscription = {
  id: number;
  email: string;
  q: string | null;
  region_code: string | null;
  cpv_division: string | null;
  min_value: number | null;
  token: string;
  status: "pending" | "active" | "unsubscribed";
  created_at: string;
  confirmed_at: string | null;
  last_sent_at: string | null;
};

export type NewSubscription = Pick<
  AlertSubscription,
  "email" | "q" | "region_code" | "cpv_division" | "min_value" | "token"
>;

/** Профил на фирма, както го превежда съветникът (lib/advisor). */
export type MatchProfile = {
  cpvPrefixes: string[];
  keywords: string[];
  regions: string[];
  minValue?: number;
  maxValue?: number;
};

/** Отворена поръчка в съкратен вид — каквото съветникът чете. */
export type MatchedTender = Pick<
  Tender,
  | "id"
  | "title"
  | "lot_number"
  | "lot_title"
  | "description"
  | "cpv_code"
  | "cpv_label"
  | "cpv_division"
  | "buyer_name"
  | "buyer_locality"
  | "region_code"
  | "value_eur"
  | "deadline_at"
  | "published_at"
  | "procedure_type"
  | "notice_type"
  | "contract_type"
  | "eu_funded"
> & { score: number };

/** Колко въпроса остават на посетителя днес; -1 лимитът му е изчерпан, -2 общият. */
export type AdvisorQuota = number;

/**
 * Едно място за всички операции с данни. В production това е Supabase;
 * без ключове (локална разработка, тест) — JSON файл в `data/`, който
 * пълни скриптът за внос. Страниците не знаят коя от двете е.
 */
export interface Store {
  readonly kind: "supabase" | "file";
  searchTenders(filters: TenderFilters): Promise<SearchResult>;
  getTender(id: number): Promise<Tender | null>;
  upsertTenders(rows: Tender[]): Promise<number>;
  recentTenderIds(limit: number): Promise<{ id: number; updated_at: string | null }[]>;
  recordImportRun(run: {
    source_date: string;
    status: "ok" | "missing" | "error";
    rows_count: number;
    message?: string;
  }): Promise<void>;
  lastImportedDate(): Promise<string | null>;

  createSubscription(sub: NewSubscription): Promise<void>;
  findSubscriptionByToken(token: string): Promise<AlertSubscription | null>;
  setSubscriptionStatus(token: string, status: AlertSubscription["status"]): Promise<void>;
  activeSubscriptions(): Promise<AlertSubscription[]>;
  markSubscriptionSent(id: number, at: string): Promise<void>;

  /** Отворени поръчки, подредени по прилика с профила (най-добрите първи). */
  matchTenders(profile: MatchProfile, limit: number): Promise<MatchedTender[]>;
  consumeAdvisorQuota(visitor: string, perVisitor: number, perDay: number): Promise<AdvisorQuota>;
  refundAdvisorQuota(visitor: string): Promise<void>;
}
