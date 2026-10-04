import { FileStore } from "./file-store";
import { SupabaseStore } from "./supabase-store";
import type { Store } from "./types";

let store: Store | null = null;

/**
 * Supabase, ако са зададени `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`;
 * иначе локалният JSON файл. Виж lib/store/types.ts.
 */
export function getStore(): Store {
  if (!store) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    store = url && key ? new SupabaseStore(url, key) : new FileStore();
  }
  return store;
}

export type { Store, AlertSubscription } from "./types";
