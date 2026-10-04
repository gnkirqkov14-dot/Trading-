import { FileStore } from "./file-store";
import { SupabaseStore } from "./supabase-store";
import type { Store } from "./types";

let store: Store | null = null;

/**
 * Supabase, ако са зададени `SUPABASE_URL` и `SUPABASE_PUBLISHABLE_KEY`
 * (плюс `TENDERS_DB_SECRET` за запис); иначе локалният JSON файл.
 * Виж lib/store/types.ts.
 */
export function getStore(): Store {
  if (!store) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    store =
      url && key
        ? new SupabaseStore(url, key, process.env.TENDERS_DB_SECRET ?? "")
        : new FileStore();
  }
  return store;
}

export type { Store, AlertSubscription } from "./types";
