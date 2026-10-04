import { promises as fs } from "node:fs";
import path from "node:path";
import type { SearchResult, Tender, TenderFilters } from "@/lib/eop/types";
import type { AlertSubscription, NewSubscription, Store } from "./types";

/**
 * Хранилище в JSON файлове под `data/` — само за локална разработка и
 * тестове, когато няма Supabase ключове. Пълни се със
 * `npm run import -- 2026-10-01 2026-10-03`. Не е за production: на
 * Vercel файловата система е само за четене.
 */

type StoredTender = Tender & { updated_at: string };

type Db = {
  tenders: Record<string, StoredTender>;
  runs: { source_date: string; status: string; rows_count: number; message?: string }[];
  subscriptions: AlertSubscription[];
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
}
