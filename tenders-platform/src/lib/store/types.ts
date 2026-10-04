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
}
