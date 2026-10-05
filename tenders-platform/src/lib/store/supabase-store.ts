import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { SearchResult, Tender, TenderFilters } from "@/lib/eop/types";
import type { GrantCall, GrantKnown } from "@/lib/grants/types";
import type { SavedProfile } from "@/lib/advisor/types";
import type { CompanyData, TenderGuide } from "@/lib/apply/types";
import type {
  AdvisorQuota,
  AiUsageRow,
  AlertSubscription,
  MatchedTender,
  MatchProfile,
  NewSubscription,
  Store,
} from "./types";

const UPSERT_CHUNK = 300;

/**
 * Достъп до Supabase само през функциите `public.tenders_*` (виж
 * supabase/migrations/0001_init.sql). Таблиците са в затворена схема
 * `tenders` в базата на imotpoint, затова тук е публичният (publishable)
 * ключ, а не service role: сайтът за поръчки не може да стигне до
 * таблиците на imotpoint. Записът и абонатите искат `TENDERS_DB_SECRET`.
 */
export class SupabaseStore implements Store {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;
  private secret: string;

  constructor(url: string, publishableKey: string, secret: string) {
    this.db = createClient(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.secret = secret;
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) throw new Error(`Supabase ${fn}: ${error.message}`);
    return data as T;
  }

  private requireSecret() {
    if (!this.secret) throw new Error("TENDERS_DB_SECRET липсва");
    return this.secret;
  }

  async searchTenders(filters: TenderFilters): Promise<SearchResult> {
    // tenders_search_ext (0006): същото като tenders_search плюс новите филтри.
    const result = await this.rpc<{ rows: Tender[]; total: number }>("tenders_search_ext", {
      p: {
        q: filters.q ?? null,
        region: filters.region ?? null,
        category: filters.category ?? null,
        min: filters.minValue ?? null,
        max: filters.maxValue ?? null,
        open_only: filters.openOnly !== false,
        updated_since: filters.updatedSince ?? null,
        sort: filters.sort ?? "deadline",
        kind: filters.kind ?? null,
        buyer: filters.buyer ?? null,
        buyer_type: filters.buyerType ?? null,
        eu_only: filters.euOnly ?? false,
        small_only: filters.smallOnly ?? false,
        min_days: filters.minDays ?? null,
        new_days: filters.newDays ?? null,
        limit: filters.limit ?? 20,
        offset: filters.offset ?? 0,
      },
    });
    return {
      rows: (result?.rows ?? []).map(numericFix),
      total: Number(result?.total ?? 0),
    };
  }

  async getTender(id: number): Promise<Tender | null> {
    const row = await this.rpc<Tender | null>("tenders_get", { p_id: id });
    return row ? numericFix(row) : null;
  }

  async upsertTenders(rows: Tender[]): Promise<number> {
    const secret = this.requireSecret();
    let written = 0;
    for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
      written += await this.rpc<number>("tenders_upsert", {
        p_secret: secret,
        p_rows: rows.slice(i, i + UPSERT_CHUNK),
      });
    }
    return written;
  }

  async recentTenderIds(limit: number) {
    return (await this.rpc<{ id: number; updated_at: string | null }[]>("tenders_recent_ids", {
      p_limit: limit,
    })) ?? [];
  }

  async recordImportRun(run: {
    source_date: string;
    status: "ok" | "missing" | "error";
    rows_count: number;
    message?: string;
  }) {
    await this.rpc("tenders_record_import", {
      p_secret: this.requireSecret(),
      p_date: run.source_date,
      p_status: run.status,
      p_rows: run.rows_count,
      p_message: run.message ?? null,
    });
  }

  async lastImportedDate() {
    return (await this.rpc<string | null>("tenders_last_import", {})) ?? null;
  }

  async createSubscription(sub: NewSubscription) {
    await this.rpc("tenders_alert_create", {
      p_secret: this.requireSecret(),
      p_email: sub.email,
      p_q: sub.q,
      p_region: sub.region_code,
      p_category: sub.cpv_division,
      p_min: sub.min_value,
      p_token: sub.token,
    });
  }

  async findSubscriptionByToken(token: string) {
    return (
      (await this.rpc<AlertSubscription | null>("tenders_alert_by_token", {
        p_secret: this.requireSecret(),
        p_token: token,
      })) ?? null
    );
  }

  async setSubscriptionStatus(token: string, status: AlertSubscription["status"]) {
    await this.rpc("tenders_alert_set_status", {
      p_secret: this.requireSecret(),
      p_token: token,
      p_status: status,
    });
  }

  async activeSubscriptions() {
    return (
      (await this.rpc<AlertSubscription[]>("tenders_alert_active", {
        p_secret: this.requireSecret(),
      })) ?? []
    ).map((s) => ({ ...s, min_value: s.min_value === null ? null : Number(s.min_value) }));
  }

  async markSubscriptionSent(id: number, at: string) {
    await this.rpc("tenders_alert_mark_sent", {
      p_secret: this.requireSecret(),
      p_id: id,
      p_at: at,
    });
  }

  async matchTenders(profile: MatchProfile, limit: number): Promise<MatchedTender[]> {
    const rows = await this.rpc<MatchedTender[]>("tenders_match", {
      p_cpv_prefixes: profile.cpvPrefixes,
      p_keywords: profile.keywords,
      p_regions: profile.regions.length ? profile.regions : null,
      p_min: profile.minValue ?? null,
      p_max: profile.maxValue ?? null,
      p_limit: limit,
    });
    return (rows ?? []).map((r) => ({
      ...r,
      value_eur: r.value_eur === null ? null : Number(r.value_eur),
      score: Number(r.score),
    }));
  }

  async consumeAdvisorQuota(visitor: string, perVisitor: number, perDay: number): Promise<AdvisorQuota> {
    return Number(
      await this.rpc<number>("tenders_advisor_consume", {
        p_secret: this.requireSecret(),
        p_visitor: visitor,
        p_max_per_visitor: perVisitor,
        p_max_per_day: perDay,
      }),
    );
  }

  async refundAdvisorQuota(visitor: string) {
    await this.rpc("tenders_advisor_refund", { p_secret: this.requireSecret(), p_visitor: visitor });
  }

  async grantsKnown() {
    return (await this.rpc<GrantKnown[]>("tenders_grants_known", { p_secret: this.requireSecret() })) ?? [];
  }

  async upsertGrants(rows: Partial<GrantCall>[]) {
    let written = 0;
    for (let i = 0; i < rows.length; i += 100) {
      written += Number(
        await this.rpc<number>("tenders_grants_upsert", {
          p_secret: this.requireSecret(),
          p_rows: rows.slice(i, i + 100),
        }),
      );
    }
    return written;
  }

  async deactivateGrants(seenBefore: string) {
    return Number(
      await this.rpc<number>("tenders_grants_deactivate", {
        p_secret: this.requireSecret(),
        p_seen_before: seenBefore,
      }),
    );
  }

  async replacePlannedGrants(source: string, rows: Partial<GrantCall>[]) {
    return Number(
      await this.rpc<number>("tenders_grants_replace_planned", {
        p_secret: this.requireSecret(),
        p_source: source,
        p_rows: rows,
      }),
    );
  }

  async getGrantSource(id: string) {
    return (
      (await this.rpc<{ pdf_url: string | null } | null>("tenders_grant_source_get", {
        p_secret: this.requireSecret(),
        p_id: id,
      })) ?? null
    );
  }

  async setGrantSource(src: {
    id: string;
    programme: string;
    page_url: string;
    pdf_url: string;
    rows: number;
    message: string | null;
  }) {
    await this.rpc("tenders_grant_source_set", {
      p_secret: this.requireSecret(),
      p_id: src.id,
      p_programme: src.programme,
      p_page_url: src.page_url,
      p_pdf_url: src.pdf_url,
      p_rows: src.rows,
      p_message: src.message,
    });
  }

  async listGrants(businessOnly: boolean) {
    const rows = (await this.rpc<GrantCall[]>("tenders_grants_list", { p_business_only: businessOnly })) ?? [];
    const num = (v: number | null) => (v === null ? null : Number(v));
    return rows.map((g) => ({
      ...g,
      budget_eur: num(g.budget_eur),
      grant_min_eur: num(g.grant_min_eur),
      grant_max_eur: num(g.grant_max_eur),
      max_aid_pct: num(g.max_aid_pct),
    }));
  }

  async getProfile(token: string) {
    return (
      (await this.rpc<SavedProfile | null>("tenders_profile_get", {
        p_secret: this.requireSecret(),
        p_token: token,
      })) ?? null
    );
  }

  async saveProfile(
    token: string,
    patch: Partial<Omit<SavedProfile, "token" | "last_run_at" | "updated_at">>,
    ran: boolean,
  ) {
    await this.rpc("tenders_profile_save", {
      p_secret: this.requireSecret(),
      p_token: token,
      p_description: patch.description ?? null,
      p_answers: patch.answers ?? null,
      p_profile: patch.profile ?? null,
      p_filters: patch.filters ?? null,
      p_results: patch.results ?? null,
      p_ran: ran,
    });
  }

  async saveCompany(token: string, company: Partial<CompanyData>) {
    await this.rpc("tenders_profile_company_save", {
      p_secret: this.requireSecret(),
      p_token: token,
      p_company: company,
    });
  }

  async noticeTenderIds(noticeId: number) {
    const ids = await this.rpc<number[] | null>("tenders_notice_ids", { p_notice_id: noticeId });
    return (ids ?? []).map(Number);
  }

  async getGuide<T = TenderGuide>(key: string) {
    return (
      (await this.rpc<{ source_hash: string; guide: T; updated_at: string } | null>("tenders_guide_get", {
        p_secret: this.requireSecret(),
        p_key: key,
      })) ?? null
    );
  }

  async saveGuide(key: string, sourceHash: string, guide: unknown) {
    await this.rpc("tenders_guide_save", {
      p_secret: this.requireSecret(),
      p_key: key,
      p_hash: sourceHash,
      p_guide: guide,
    });
  }

  async logAiUsage(row: AiUsageRow) {
    await this.rpc("tenders_ai_usage_log", { p_secret: this.requireSecret(), p_row: row });
  }
}

/** numeric от Postgres може да дойде като низ; страниците искат число. */
function numericFix(t: Tender): Tender {
  return { ...t, value_eur: t.value_eur === null ? null : Number(t.value_eur) };
}
