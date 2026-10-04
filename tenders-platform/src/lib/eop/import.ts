import { cpvDivision } from "./cpv";
import { normalizeRegion } from "./regions";
import type { Tender } from "./types";

/**
 * Внос на дневните отворени данни на ЦАИС ЕОП (Агенцията по обществени
 * поръчки). Всеки ден около 06:00 UTC на storage.eop.bg се появява папка
 * `open-data-ГГГГ-ММ-ДД/` с файловете за предишния ден:
 *
 * - „…данни за поръчки…“ — плосък JSON, по ред на поръчка/обособена
 *   позиция. Оттук идват срокът, бюджетът, видът процедура, CPV и купувачът.
 * - „…за обявления… съгласно стандарт OCDS“ — стандартът OCDS (лиценз
 *   CC0). Оттук взимаме дългото описание и адреса на възложителя.
 *
 * Имената на файловете са на кирилица и с дата, затова не ги изписваме
 * наготово, а четем списъка на папката (S3/MinIO XML) и избираме по
 * ключови думи. Ако държавата преименува файл, вносът пада с ясна грешка
 * вместо тихо да не внесе нищо.
 */

export const EOP_STORAGE = "https://storage.eop.bg";
const BGN_PER_EUR = 1.95583;
const FETCH_TIMEOUT_MS = 60_000;

type RawTenderRow = {
  noticeId: number | null;
  publicationDate: string | null;
  uniqueProcurementNumber: string | null;
  tenderId: number;
  procedureType: string | null;
  subject: string | null;
  mainCpvCode: string | null;
  mainCpvDescription: string | null;
  typeOfContract: string | null;
  estimatedValue: string | number | null;
  currency: string | null;
  buyerName: string | null;
  buyerRegistryNumber: string | null;
  buyerType: string | null;
  buyerMainActivity: string | null;
  submissionDeadline: string | null;
  noticeType: string | null;
  lotIdentifier: string | null;
  isEuFunded: string | null;
  europeanProgram: string | null;
  executionPlaceNuts: string | null;
  lotTenderName: string | null;
  isCancelled: string | null;
};

type OcdsParty = {
  roles?: string[];
  address?: { locality?: string; region?: string };
};

type OcdsRelease = {
  id: string;
  tag?: string[];
  tender?: {
    id?: string;
    description?: string;
    lots?: { id?: string; description?: string }[];
  };
  parties?: OcdsParty[];
};

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "tenders-platform-importer/1.0" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Списъкът с файлове в дневната папка. `null`, ако за деня няма данни. */
export async function listDayFiles(date: string): Promise<string[] | null> {
  const res = await fetchWithTimeout(`${EOP_STORAGE}/open-data-${date}/`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ЦАИС ЕОП: ${res.status} при списъка за ${date}`);
  const xml = await res.text();
  if (xml.includes("<Code>NoSuchBucket</Code>")) return null;
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXml(m[1]));
}

function decodeXml(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#34;|&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}

async function fetchJson<T>(date: string, key: string): Promise<T> {
  const url = `${EOP_STORAGE}/open-data-${date}/${encodeURIComponent(key)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`ЦАИС ЕОП: ${res.status} за ${key}`);
  // Файловете идват с BOM; JSON.parse не го приема.
  const text = (await res.text()).replace(/^﻿/, "");
  return JSON.parse(text) as T;
}

/**
 * Местно време в София → ISO в UTC. Порталът пише сроковете без часова
 * зона („2026-10-19T23:59:59“), а те са българско време — лятно или
 * зимно според датата.
 */
export function sofiaLocalToIso(local: string | null | undefined): string | null {
  if (!local) return null;
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", frac = "0"] = m;
  const ms = Number(frac.slice(0, 3).padEnd(3, "0"));
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s, ms);
  let utc = asUtc - sofiaOffsetMinutes(asUtc) * 60_000;
  utc = asUtc - sofiaOffsetMinutes(utc) * 60_000;
  return new Date(utc).toISOString();
}

const sofiaFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Sofia",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function sofiaOffsetMinutes(utcMs: number): number {
  const parts = Object.fromEntries(
    sofiaFormatter.formatToParts(new Date(utcMs)).map((p) => [p.type, p.value]),
  );
  const local = Date.UTC(
    +parts.year,
    +parts.month - 1,
    +parts.day,
    +parts.hour,
    +parts.minute,
    +parts.second,
  );
  return Math.round((local - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/** „652600,00“ → 652600. Сумите в лева (до 2026 г.) се превръщат в евро. */
export function parseAmount(
  value: string | number | null | undefined,
  currency: string | null | undefined,
): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/\s/g, "").replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  const eur = (currency ?? "EUR").toUpperCase() === "BGN" ? n / BGN_PER_EUR : n;
  return Math.round(eur * 100) / 100;
}

function yes(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase() === "да";
}

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t : null;
}

/** Номерът на обявлението стои в id-то на OCDS записа: „…-554375-802965/2026-…“. */
function noticeIdFromRelease(id: string): number | null {
  const m = id.match(/-(\d+)\/\d{4}-\d{2}-\d{2}/);
  return m ? Number(m[1]) : null;
}

export function normalizeDay(
  date: string,
  rows: RawTenderRow[],
  ocds: { releases?: OcdsRelease[] } | null,
): Tender[] {
  const byNotice = new Map<number, OcdsRelease>();
  for (const release of ocds?.releases ?? []) {
    if (!release.tag?.includes("tender")) continue;
    const noticeId = noticeIdFromRelease(release.id);
    if (noticeId !== null) byNotice.set(noticeId, release);
  }

  const result: Tender[] = [];
  for (const row of rows) {
    if (!row || typeof row.tenderId !== "number") continue;
    const release = row.noticeId ? byNotice.get(row.noticeId) : undefined;
    const buyer = release?.parties?.find((p) => p.roles?.includes("buyer"));
    const lot = row.lotIdentifier
      ? release?.tender?.lots?.find((l) => l.id === row.lotIdentifier)
      : undefined;

    const region =
      normalizeRegion(row.executionPlaceNuts) ?? normalizeRegion(buyer?.address?.region);

    result.push({
      id: row.tenderId,
      notice_id: row.noticeId ?? null,
      procurement_number: clean(row.uniqueProcurementNumber),
      title: clean(row.subject) ?? clean(row.lotTenderName) ?? `Поръчка ${row.tenderId}`,
      lot_number: clean(row.lotIdentifier),
      lot_title: clean(row.lotTenderName),
      description: (lot?.description ?? release?.tender?.description ?? "").trim() || null,
      notice_type: clean(row.noticeType),
      procedure_type: clean(row.procedureType),
      contract_type: clean(row.typeOfContract),
      cpv_code: clean(row.mainCpvCode),
      cpv_label: clean(row.mainCpvDescription),
      cpv_division: cpvDivision(row.mainCpvCode),
      buyer_name: clean(row.buyerName) ?? "Неизвестен възложител",
      buyer_eik: clean(row.buyerRegistryNumber),
      buyer_type: clean(row.buyerType),
      buyer_activity: clean(row.buyerMainActivity),
      buyer_locality: clean(buyer?.address?.locality),
      region_code: region,
      value_eur: parseAmount(row.estimatedValue, row.currency),
      deadline_at: sofiaLocalToIso(row.submissionDeadline),
      published_at: sofiaLocalToIso(row.publicationDate),
      eu_funded: yes(row.isEuFunded),
      eu_program: clean(row.europeanProgram),
      is_cancelled: yes(row.isCancelled),
      source_date: date,
    });
  }
  return result;
}

/** Тегли и нормализира всичко за един ден. `null`, ако денят още не е публикуван. */
export async function fetchDay(date: string): Promise<Tender[] | null> {
  const keys = await listDayFiles(date);
  if (!keys) return null;

  const tendersKey = keys.find((k) => k.includes("за поръчки"));
  if (!tendersKey) {
    throw new Error(`ЦАИС ЕОП: за ${date} няма файл „за поръчки“ (${keys.length} файла)`);
  }
  const ocdsKey = keys.find((k) => k.includes("OCDS"));

  const [rows, ocds] = await Promise.all([
    fetchJson<RawTenderRow[]>(date, tendersKey),
    ocdsKey
      ? fetchJson<{ releases?: OcdsRelease[] }>(date, ocdsKey).catch(() => null)
      : Promise.resolve(null),
  ]);

  return normalizeDay(date, Array.isArray(rows) ? rows : [], ocds);
}

/** „Вчера“ по българско време, като ГГГГ-ММ-ДД. */
export function sofiaYesterday(now = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
