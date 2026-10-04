/**
 * Ръчен внос на дни от ЦАИС ЕОП.
 *
 *   npm run import -- 2026-10-01              един ден
 *   npm run import -- 2026-09-01 2026-10-03   период
 *
 * С `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` в средата пише в
 * Supabase (така се пълни базата първия път с история). Без тях пише в
 * `data/db.json` за локален преглед на сайта.
 */
import { addDays } from "../src/lib/eop/import";
import { importDate } from "../src/lib/eop/run-import";
import { getStore } from "../src/lib/store";

async function main() {
  const [from, to = from] = process.argv.slice(2);
  if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    console.error("Употреба: npm run import -- ГГГГ-ММ-ДД [ГГГГ-ММ-ДД]");
    process.exit(1);
  }
  const store = getStore();
  console.log(`Пиша в: ${store.kind === "supabase" ? "Supabase" : "data/db.json"}`);

  let total = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const r = await importDate(store, d);
    total += r.rows;
    console.log(`${d}: ${r.status}${r.rows ? `, ${r.rows} поръчки` : ""}${r.message ? ` (${r.message})` : ""}`);
  }
  console.log(`Общо: ${total}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
