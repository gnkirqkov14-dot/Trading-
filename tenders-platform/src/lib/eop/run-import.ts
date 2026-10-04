import type { Store } from "@/lib/store/types";
import { addDays, fetchDay } from "./import";

export type ImportResult = {
  date: string;
  status: "ok" | "missing" | "error";
  rows: number;
  message?: string;
};

/** Внася един ден и записва резултата в дневника на вноса. */
export async function importDate(store: Store, date: string): Promise<ImportResult> {
  try {
    const rows = await fetchDay(date);
    if (rows === null) {
      await store.recordImportRun({ source_date: date, status: "missing", rows_count: 0 });
      return { date, status: "missing", rows: 0 };
    }
    const written = await store.upsertTenders(rows);
    await store.recordImportRun({ source_date: date, status: "ok", rows_count: written });
    return { date, status: "ok", rows: written };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await store
      .recordImportRun({ source_date: date, status: "error", rows_count: 0, message })
      .catch(() => {});
    return { date, status: "error", rows: 0, message };
  }
}

/**
 * Внася от деня след последния успешен до `until` включително, но не
 * повече от `maxDays` наведнъж — ако cron-ът е пропуснал няколко дни,
 * следващото пускане ги наваксва само. При празна база първото пускане
 * взима последните `firstRunDays` дни, за да има отворени поръчки веднага
 * (сроковете обикновено са 2 до 6 седмици).
 */
export async function importCatchUp(
  store: Store,
  until: string,
  maxDays = 7,
  firstRunDays = 30,
): Promise<ImportResult[]> {
  const last = await store.lastImportedDate();
  if (!last) maxDays = firstRunDays;
  let from = last ? addDays(last, 1) : addDays(until, -(firstRunDays - 1));
  if (from > until) from = until;
  const results: ImportResult[] = [];
  for (let d = from, n = 0; d <= until && n < maxDays; d = addDays(d, 1), n++) {
    results.push(await importDate(store, d));
  }
  return results;
}
