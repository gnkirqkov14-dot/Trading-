import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SearchResult, Tender, TenderFilters } from "@/lib/eop/types";
import type { AlertSubscription, NewSubscription, Store } from "./types";

const UPSERT_CHUNK = 500;

/** Знаците, които PostgREST третира специално във филтрите. */
function escapeLike(q: string) {
  return q.replace(/[%_,()\\]/g, " ").trim();
}

export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    // Ключът е service role — само на сървъра, никога в браузъра.
    this.db = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async searchTenders(filters: TenderFilters): Promise<SearchResult> {
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    let query = this.db.from("tenders").select("*", { count: "exact" });

    if (filters.openOnly !== false) {
      query = query.gte("deadline_at", new Date().toISOString()).eq("is_cancelled", false);
    }
    if (filters.q) {
      for (const word of escapeLike(filters.q).toLowerCase().split(/\s+/).filter(Boolean)) {
        query = query.ilike("search_text", `%${word}%`);
      }
    }
    if (filters.region) query = query.eq("region_code", filters.region);
    if (filters.category) query = query.eq("cpv_division", filters.category);
    if (filters.minValue !== undefined) query = query.gte("value_eur", filters.minValue);
    if (filters.maxValue !== undefined) query = query.lte("value_eur", filters.maxValue);
    if (filters.updatedSince) query = query.gt("updated_at", filters.updatedSince);

    if (filters.sort === "value") {
      query = query.order("value_eur", { ascending: false, nullsFirst: false });
    } else if (filters.sort === "newest") {
      query = query.order("published_at", { ascending: false, nullsFirst: false });
    } else {
      query = query.order("deadline_at", { ascending: true, nullsFirst: false });
    }

    const { data, error, count } = await query
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Supabase: ${error.message}`);
    return { rows: (data ?? []) as Tender[], total: count ?? 0 };
  }

  async getTender(id: number): Promise<Tender | null> {
    const { data, error } = await this.db.from("tenders").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data as Tender | null) ?? null;
  }

  async upsertTenders(rows: Tender[]): Promise<number> {
    let written = 0;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK);
      const { error } = await this.db.from("tenders").upsert(chunk, { onConflict: "id" });
      if (error) throw new Error(`Supabase: ${error.message}`);
      written += chunk.length;
    }
    return written;
  }

  async recentTenderIds(limit: number) {
    const { data, error } = await this.db
      .from("tenders")
      .select("id, updated_at")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(limit);
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data ?? []) as { id: number; updated_at: string | null }[];
  }

  async recordImportRun(run: {
    source_date: string;
    status: "ok" | "missing" | "error";
    rows_count: number;
    message?: string;
  }) {
    const { error } = await this.db.from("import_runs").insert(run);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async lastImportedDate() {
    const { data, error } = await this.db
      .from("import_runs")
      .select("source_date")
      .eq("status", "ok")
      .order("source_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data?.source_date as string | undefined) ?? null;
  }

  async createSubscription(sub: NewSubscription) {
    const { error } = await this.db.from("alert_subscriptions").insert(sub);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async findSubscriptionByToken(token: string) {
    const { data, error } = await this.db
      .from("alert_subscriptions")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data as AlertSubscription | null) ?? null;
  }

  async setSubscriptionStatus(token: string, status: AlertSubscription["status"]) {
    const patch: Partial<AlertSubscription> = { status };
    if (status === "active") patch.confirmed_at = new Date().toISOString();
    const { error } = await this.db.from("alert_subscriptions").update(patch).eq("token", token);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }

  async activeSubscriptions() {
    const { data, error } = await this.db
      .from("alert_subscriptions")
      .select("*")
      .eq("status", "active");
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data ?? []) as AlertSubscription[];
  }

  async markSubscriptionSent(id: number, at: string) {
    const { error } = await this.db
      .from("alert_subscriptions")
      .update({ last_sent_at: at })
      .eq("id", id);
    if (error) throw new Error(`Supabase: ${error.message}`);
  }
}
