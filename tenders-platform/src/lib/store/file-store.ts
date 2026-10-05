import { promises as fs } from "node:fs";
import path from "node:path";
import type { BuyerType, SearchResult, Tender, TenderFilters } from "@/lib/eop/types";
import type { GrantCall } from "@/lib/grants/types";
import type { SavedProfile } from "@/lib/advisor/types";
import type { CompanyData, TenderGuide } from "@/lib/apply/types";
import { EMPTY_RESULTS } from "@/lib/advisor/types";
import type {
  AdvisorQuota,
  AlertSubscription,
  MatchedTender,
  MatchProfile,
  NewSubscription,
  Store,
} from "./types";

/**
 * Хранилище в JSON файлове под `data/` — само за локална разработка и
 * тестове, когато няма Supabase ключове. Пълни се със
 * `npm run import -- 2026-10-01 2026-10-03`. Не е за production: на
 * Vercel файловата система е само за четене.
 */

type StoredTender = Tender & { updated_at: string };

/** Същото групиране като в tenders_search_ext (0006). */
const BUYER_TYPE_PREFIXES: Record<BuyerType, string[]> = {
  municipal: ["Местен орган"],
  state: ["Орган на централната власт", "Регионален орган"],
  company: ["Публично предприятие"],
  public: ["Публичноправна организация"],
};

type Db = {
  tenders: Record<string, StoredTender>;
  runs: { source_date: string; status: string; rows_count: number; message?: string }[];
  subscriptions: AlertSubscription[];
  advisorUsage?: Record<string, number>;
  grants?: Record<string, GrantCall & { last_seen_at: string }>;
  grantSources?: Record<string, { pdf_url: string | null }>;
  profiles?: Record<string, SavedProfile>;
  guides?: Record<string, { source_hash: string; guide: unknown; updated_at: string }>;
};

export class FileStore implements Store {
  readonly kind = "file" as const;
  private file: string;

  constructor(dir = path.join(process.cwd(), "data")) {
    this.file = path.join(dir, "db.json");
  }

  private async load(): Promise<Db> {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8")) as Db;
    } catch {
      return { tenders: {}, runs: [], subscriptions: [] };
    }
  }

  private async save(db: Db) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(db));
  }

  async searchTenders(filters: TenderFilters): Promise<SearchResult> {
    const db = await this.load();
    const now = Date.now();
    const words = (filters.q ?? "").toLowerCase().split(/\s+/).filter(Boolean);

    let rows = Object.values(db.tenders).filter((t) => {
      if (filters.openOnly !== false) {
        if (t.is_cancelled || !t.deadline_at || Date.parse(t.deadline_at) < now) return false;
      }
      if (words.length) {
        const hay = [t.title, t.lot_title, t.buyer_name, t.cpv_label, t.buyer_locality]
          .join(" ")
          .toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      if (filters.region && t.region_code !== filters.region) return false;
      if (filters.category && t.cpv_division !== filters.category) return false;
      if (filters.minValue !== undefined && (t.value_eur ?? -1) < filters.minValue) return false;
      if (filters.maxValue !== undefined && (t.value_eur ?? Infinity) > filters.maxValue) return false;
      if (filters.updatedSince && t.updated_at <= filters.updatedSince) return false;
      if (filters.kind && t.contract_type !== filters.kind) return false;
      if (filters.buyer && !t.buyer_name.toLowerCase().includes(filters.buyer.toLowerCase())) return false;
      if (filters.buyerType && !BUYER_TYPE_PREFIXES[filters.buyerType].some((p) => t.buyer_type?.startsWith(p))) return false;
      if (filters.euOnly && !t.eu_funded) return false;
      if (
        filters.smallOnly &&
        t.procedure_type !== "Събиране на оферти с обява" &&
        !t.notice_type?.startsWith("Обява за събиране на оферти")
      ) {
        return false;
      }
      if (filters.minDays && (!t.deadline_at || Date.parse(t.deadline_at) < now + filters.minDays * 86_400_000)) return false;
      if (filters.newDays && (!t.published_at || Date.parse(t.published_at) < now - filters.newDays * 86_400_000)) return false;
      return true;
    });

    const ts = (v: string | null) => (v ? Date.parse(v) : NaN);
    rows.sort((a, b) => {
      if (filters.sort === "value") return (b.value_eur ?? -1) - (a.value_eur ?? -1);
      if (filters.sort === "newest") return (ts(b.published_at) || 0) - (ts(a.published_at) || 0);
      return (ts(a.deadline_at) || Infinity) - (ts(b.deadline_at) || Infinity);
    });

    const total = rows.length;
    const offset = Math.max(filters.offset ?? 0, 0);
    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    rows = rows.slice(offset, offset + limit);
    return { rows, total };
  }

  async getTender(id: number) {
    const db = await this.load();
    return db.tenders[String(id)] ?? null;
  }

  async upsertTenders(rows: Tender[]) {
    const db = await this.load();
    const now = new Date().toISOString();
    for (const row of rows) {
      const old = db.tenders[String(row.id)];
      const changed = !old || JSON.stringify({ ...old, updated_at: "" }) !== JSON.stringify({ ...row, updated_at: "" });
      db.tenders[String(row.id)] = { ...row, updated_at: changed ? now : old.updated_at };
    }
    await this.save(db);
    return rows.length;
  }

  async recentTenderIds(limit: number) {
    const db = await this.load();
    return Object.values(db.tenders)
      .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""))
      .slice(0, limit)
      .map((t) => ({ id: t.id, updated_at: t.updated_at }));
  }

  async recordImportRun(run: { source_date: string; status: "ok" | "missing" | "error"; rows_count: number; message?: string }) {
    const db = await this.load();
    db.runs.push(run);
    await this.save(db);
  }

  async lastImportedDate() {
    const db = await this.load();
    const ok = db.runs.filter((r) => r.status === "ok").map((r) => r.source_date).sort();
    return ok.at(-1) ?? null;
  }

  async createSubscription(sub: NewSubscription) {
    const db = await this.load();
    db.subscriptions.push({
      ...sub,
      id: db.subscriptions.length + 1,
      status: "pending",
      created_at: new Date().toISOString(),
      confirmed_at: null,
      last_sent_at: null,
    });
    await this.save(db);
  }

  async findSubscriptionByToken(token: string) {
    const db = await this.load();
    return db.subscriptions.find((s) => s.token === token) ?? null;
  }

  async setSubscriptionStatus(token: string, status: AlertSubscription["status"]) {
    const db = await this.load();
    const sub = db.subscriptions.find((s) => s.token === token);
    if (sub) {
      sub.status = status;
      if (status === "active") sub.confirmed_at = new Date().toISOString();
      await this.save(db);
    }
  }

  async activeSubscriptions() {
    const db = await this.load();
    return db.subscriptions.filter((s) => s.status === "active");
  }

  async markSubscriptionSent(id: number, at: string) {
    const db = await this.load();
    const sub = db.subscriptions.find((s) => s.id === id);
    if (sub) {
      sub.last_sent_at = at;
      await this.save(db);
    }
  }

  /** Същото точкуване като tenders_match в 0002_advisor.sql. */
  async matchTenders(profile: MatchProfile, limit: number): Promise<MatchedTender[]> {
    const db = await this.load();
    const now = Date.now();
    const prefixes = profile.cpvPrefixes.filter((p) => /^\d{2,8}$/.test(p));
    const words = profile.keywords.map((w) => w.trim().toLowerCase()).filter((w) => w.length >= 3);
    if (!prefixes.length && !words.length) return [];

    const scored: MatchedTender[] = [];
    for (const t of Object.values(db.tenders)) {
      if (t.is_cancelled || !t.deadline_at || Date.parse(t.deadline_at) < now) continue;
      if (profile.minValue !== undefined && t.value_eur !== null && t.value_eur < profile.minValue) continue;
      if (profile.maxValue !== undefined && t.value_eur !== null && t.value_eur > profile.maxValue) continue;
      const cpvHit = Math.max(0, ...prefixes.filter((p) => (t.cpv_code ?? "").startsWith(p)).map((p) => p.length));
      const hay = [t.title, t.lot_title, t.buyer_name, t.cpv_label, t.buyer_locality, t.description]
        .join(" ")
        .toLowerCase();
      const wordHits = words.filter((w) => hay.includes(w)).length;
      if (!cpvHit && !wordHits) continue;
      const score =
        (cpvHit >= 5 ? 6 : cpvHit >= 3 ? 4 : cpvHit === 2 ? 2 : 0) +
        Math.min(wordHits, 4) * 2 +
        (profile.regions.length && t.region_code && profile.regions.includes(t.region_code) ? 2 : 0);
      scored.push({
        id: t.id,
        title: t.title,
        lot_number: t.lot_number,
        lot_title: t.lot_title,
        description: t.description ? t.description.slice(0, 500) : null,
        cpv_code: t.cpv_code,
        cpv_label: t.cpv_label,
        cpv_division: t.cpv_division,
        buyer_name: t.buyer_name,
        buyer_locality: t.buyer_locality,
        region_code: t.region_code,
        value_eur: t.value_eur,
        deadline_at: t.deadline_at,
        published_at: t.published_at,
        procedure_type: t.procedure_type,
        notice_type: t.notice_type,
        contract_type: t.contract_type,
        eu_funded: t.eu_funded,
        score,
      });
    }
    return scored
      .sort((a, b) => b.score - a.score || Date.parse(a.deadline_at!) - Date.parse(b.deadline_at!))
      .slice(0, limit);
  }

  async consumeAdvisorQuota(visitor: string, perVisitor: number, perDay: number): Promise<AdvisorQuota> {
    const db = await this.load();
    const day = new Date().toISOString().slice(0, 10);
    const usage = (db.advisorUsage ??= {});
    const total = Object.entries(usage)
      .filter(([k]) => k.startsWith(`${day}:`))
      .reduce((sum, [, n]) => sum + n, 0);
    if (total >= perDay) return -2;
    const key = `${day}:${visitor}`;
    usage[key] = (usage[key] ?? 0) + 1;
    await this.save(db);
    return usage[key] > perVisitor ? -1 : perVisitor - usage[key];
  }

  async refundAdvisorQuota(visitor: string) {
    const db = await this.load();
    const key = `${new Date().toISOString().slice(0, 10)}:${visitor}`;
    if (db.advisorUsage?.[key]) {
      db.advisorUsage[key] -= 1;
      await this.save(db);
    }
  }

  async grantsKnown() {
    const db = await this.load();
    return Object.values(db.grants ?? {})
      .filter((g) => g.kind !== "planned")
      .map((g) => ({ id: g.id, source_hash: g.source_hash, enriched: Boolean(g.enriched_at) }));
  }

  /** Същото сливане като tenders_grants_upsert: null не трие стара стойност. */
  async upsertGrants(rows: Partial<GrantCall>[]) {
    const db = await this.load();
    const grants = (db.grants ??= {});
    const now = new Date().toISOString();
    for (const row of rows) {
      if (!row.id) continue;
      const old = grants[row.id];
      const merged = { ...old } as GrantCall & { last_seen_at: string };
      for (const [k, v] of Object.entries(row)) {
        if (v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0)) {
          (merged as Record<string, unknown>)[k] = v;
        }
      }
      merged.applicant_types ??= [];
      merged.is_active = true;
      merged.last_seen_at = now;
      merged.updated_at = now;
      grants[row.id] = merged;
    }
    await this.save(db);
    return rows.length;
  }

  async deactivateGrants(seenBefore: string) {
    const db = await this.load();
    let n = 0;
    for (const g of Object.values(db.grants ?? {})) {
      if (g.kind !== "planned" && g.is_active && g.last_seen_at < seenBefore) {
        g.is_active = false;
        n++;
      }
    }
    await this.save(db);
    return n;
  }

  async replacePlannedGrants(source: string, rows: Partial<GrantCall>[]) {
    const db = await this.load();
    for (const g of Object.values(db.grants ?? {})) {
      if (g.kind === "planned" && g.source === source) g.is_active = false;
    }
    await this.save(db);
    return this.upsertGrants(rows);
  }

  async getGrantSource(id: string) {
    const db = await this.load();
    return db.grantSources?.[id] ?? null;
  }

  async setGrantSource(src: { id: string; pdf_url: string }) {
    const db = await this.load();
    (db.grantSources ??= {})[src.id] = { pdf_url: src.pdf_url };
    await this.save(db);
  }

  async listGrants(businessOnly: boolean) {
    const db = await this.load();
    const now = new Date().toISOString();
    const month = `${now.slice(0, 7)}-01`;
    return Object.values(db.grants ?? {})
      .filter((g) => g.is_active && (!businessOnly || g.for_business))
      .filter(
        (g) =>
          (g.kind === "open" && (!g.deadline_at || g.deadline_at >= now)) ||
          g.kind === "discussion" ||
          (g.kind === "planned" && (g.opens_at ?? "") >= month),
      );
  }

  async getProfile(token: string) {
    const db = await this.load();
    return db.profiles?.[token] ?? null;
  }

  async saveProfile(
    token: string,
    patch: Partial<Omit<SavedProfile, "token" | "last_run_at" | "updated_at">>,
    ran: boolean,
  ) {
    const db = await this.load();
    const profiles = (db.profiles ??= {});
    const now = new Date().toISOString();
    const old = profiles[token];
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    const base: SavedProfile = old ?? {
      token,
      description: "",
      answers: [],
      profile: { summary: "", fitAreas: [], growthAreas: [], questions: [] },
      filters: { tenders: true, grants: true, cpvPrefixes: [], keywords: [], regions: [] },
      results: EMPTY_RESULTS,
      last_run_at: null,
    };
    profiles[token] = {
      ...base,
      ...defined,
      token,
      last_run_at: ran ? now : (old?.last_run_at ?? null),
      updated_at: now,
    };
    await this.save(db);
  }

  async saveCompany(token: string, company: Partial<CompanyData>) {
    const db = await this.load();
    const p = db.profiles?.[token];
    if (!p) return;
    p.company = company;
    p.updated_at = new Date().toISOString();
    await this.save(db);
  }

  async noticeTenderIds(noticeId: number) {
    const db = await this.load();
    return Object.values(db.tenders)
      .filter((t) => t.notice_id === noticeId)
      .map((t) => t.id)
      .sort((a, b) => a - b);
  }

  async getGuide<T = TenderGuide>(key: string) {
    const db = await this.load();
    return (db.guides?.[key] as { source_hash: string; guide: T; updated_at: string } | undefined) ?? null;
  }

  async saveGuide(key: string, sourceHash: string, guide: unknown) {
    const db = await this.load();
    (db.guides ??= {})[key] = { source_hash: sourceHash, guide, updated_at: new Date().toISOString() };
    await this.save(db);
  }
}
