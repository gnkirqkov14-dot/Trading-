import { aiEnabled } from "@/lib/ai";
import type { Store } from "@/lib/store";
import { extractPlan, enrichCall } from "./enrich";
import { discoverIgrp } from "./igrp";
import {
  announcementDoc,
  docxToText,
  fetchBinary,
  fetchIsunInfo,
  listIsun,
  parseBgDateTime,
  type IsunListItem,
} from "./isun";
import type { GrantCall } from "./types";

/**
 * Ежедневното опресняване на грантовете (cron /api/cron/grants):
 *  1. Списъците в ИСУН → срокове от страницата на всяка процедура.
 *  2. Нови или променени процедури → AI чете обявата (плаща се веднъж).
 *  3. Процедури, които вече ги няма в списъка → неактивни.
 *  4. ИГРП на програмите → планираните процедури (AI чете PDF-а, само
 *     когато файлът е нов).
 * Таваните са на брой AI четения и на време, за да се събере във функция
 * от 300 секунди; каквото не стигне днес, остава за утре.
 */

export type GrantsSyncReport = {
  listed: number;
  enriched: number;
  deactivated: number;
  plans: { id: string; rows: number | null; message: string | null }[];
  errors: string[];
};

const PAGE_CONCURRENCY = 4;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

function dateOnly(iso: string | null) {
  return iso ? iso.slice(0, 10) : null;
}

export async function syncGrants(
  store: Store,
  opts: { maxEnrich: number; maxPlans: number; deadline: number },
): Promise<GrantsSyncReport> {
  const report: GrantsSyncReport = { listed: 0, enriched: 0, deactivated: 0, plans: [], errors: [] };
  const startedAt = new Date().toISOString();
  const timeLeft = () => opts.deadline - Date.now();

  // 1. Списъците.
  const lists = await Promise.allSettled([listIsun("open"), listIsun("nims"), listIsun("discussion")]);
  const items: IsunListItem[] = [];
  for (const r of lists) {
    if (r.status === "fulfilled") items.push(...r.value);
    else report.errors.push(`списък: ${String(r.reason)}`);
  }
  report.listed = items.length;
  const known = new Map((await store.grantsKnown()).map((k) => [k.id, k]));

  // 2. Страниците (срокове) + AI за новите.
  let enrichBudget = aiEnabled ? opts.maxEnrich : 0;
  const rows = await mapLimit(items, PAGE_CONCURRENCY, async (item): Promise<Partial<GrantCall> | null> => {
    try {
      const info = await fetchIsunInfo(item);
      const doc = announcementDoc(info);
      const hash = doc?.key ?? "page";
      const row: Partial<GrantCall> = {
        id: item.id,
        kind: item.kind,
        source: item.source,
        code: item.code,
        title: item.title,
        programme: item.programme,
        url: item.url,
        doc_url: doc?.url ?? null,
        opens_at:
          item.kind === "discussion"
            ? dateOnly(parseBgDateTime(info.indicativeDate))
            : dateOnly(info.startsAt),
        deadline_at: info.deadlineAt,
        summary: info.aim,
      };

      const k = known.get(item.id);
      const needsAi = !k || !k.enriched || k.source_hash !== hash;
      if (needsAi && enrichBudget > 0 && timeLeft() > 60_000) {
        enrichBudget--;
        let pdf: Buffer | null = null;
        let docText: string | null = null;
        if (doc) {
          const file = await fetchBinary(doc.url).catch(() => null);
          const magic = file?.bytes.subarray(0, 4).toString();
          if (file && (file.type.includes("pdf") || magic === "%PDF")) pdf = file.bytes;
          else if (file && magic?.startsWith("PK")) docText = docxToText(file.bytes);
        }
        const extra = await enrichCall({
          code: item.code,
          title: item.title,
          programme: item.programme,
          aim: info.aim,
          pageText: docText ? `${docText.slice(0, 12000)}\n\n— Страницата в ИСУН —\n${info.text}` : info.text,
          pdf,
        });
        Object.assign(row, extra, { source_hash: hash, enriched_at: new Date().toISOString() });
        report.enriched++;
      }
      return row;
    } catch (error) {
      report.errors.push(`${item.code ?? item.id}: ${String(error).slice(0, 200)}`);
      // Поне да остане видим в списъка, иначе ще го сметнем за затворен.
      return { id: item.id, kind: item.kind, source: item.source, code: item.code, title: item.title, programme: item.programme, url: item.url };
    }
  });
  await store.upsertGrants(rows.filter((r): r is Partial<GrantCall> => r !== null));

  // 3. Изчезналите — само ако и трите списъка са минали, иначе при срив
  // на ИСУН бихме „затворили“ всичко.
  if (lists.every((r) => r.status === "fulfilled") && items.length > 0) {
    report.deactivated = await store.deactivateGrants(startedAt);
  }

  // 4. Плановете (ИГРП).
  if (aiEnabled && opts.maxPlans > 0) {
    let sources: Awaited<ReturnType<typeof discoverIgrp>> = [];
    try {
      sources = await discoverIgrp();
    } catch (error) {
      report.errors.push(`ИГРП: ${String(error).slice(0, 200)}`);
    }
    let plansLeft = opts.maxPlans;
    for (const src of sources) {
      if (plansLeft <= 0 || timeLeft() < 90_000) break;
      const seen = await store.getGrantSource(src.id);
      if (seen?.pdf_url === src.pdfUrl) continue;
      plansLeft--;
      try {
        const file = await fetchBinary(src.pdfUrl);
        const calls = await extractPlan({ programme: src.programme, year: src.year, pdf: file.bytes });
        const planned: Partial<GrantCall>[] = calls.map((c, i) => ({
          id: `${src.id}:${i + 1}`,
          kind: "planned",
          source: src.id,
          title: c.title,
          programme: src.programme,
          url: src.pageUrl,
          doc_url: src.pdfUrl,
          opens_at: c.opens_at,
          // ИГРП дава само месец на крайния срок — последния ден на месеца.
          deadline_at: c.deadline_month
            ? new Date(Date.UTC(Number(c.deadline_month.slice(0, 4)), Number(c.deadline_month.slice(5, 7)), 0, 21)).toISOString()
            : null,
          summary: c.summary,
          applicants: c.applicants,
          applicant_types: c.applicant_types,
          for_business: c.for_business,
          budget_eur: c.budget_eur,
          grant_min_eur: c.grant_min_eur,
          grant_max_eur: c.grant_max_eur,
          max_aid_pct: c.max_aid_pct,
          activities: c.activities,
          costs: c.costs,
          prepare: c.prepare,
          source_hash: src.pdfUrl,
          enriched_at: new Date().toISOString(),
        }));
        const written = await store.replacePlannedGrants(src.id, planned);
        await store.setGrantSource({
          id: src.id,
          programme: src.programme,
          page_url: src.pageUrl,
          pdf_url: src.pdfUrl,
          rows: written,
          message: src.title,
        });
        report.plans.push({ id: src.id, rows: written, message: null });
      } catch (error) {
        report.plans.push({ id: src.id, rows: null, message: String(error).slice(0, 200) });
      }
    }
  }

  return report;
}
