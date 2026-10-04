/**
 * Процедурите за безвъзмездна помощ от ИСУН 2021–2027
 * (eumis2020.government.bg). Няма API: страниците са HTML, рендиран на
 * сървъра, без вход и без защита срещу ботове (проверено 04.10.2026).
 *
 *  /bg/s/Procedure/Active            отворени процедури по програми (ЕС)
 *  /bg/s/ProcedureNims/Active        национални схеми (ФНИ, „Стартъп виза“…)
 *  /bg/s/Procedure/PublicDiscussion  проекти на обществено обсъждане (предстоят)
 *
 * Бюджетът, кандидатите и размерът на помощта ги няма в HTML-а — те са в
 * PDF „Обява за откриване на процедурата“, който чете lib/grants/enrich.ts.
 */

import { strFromU8, unzipSync } from "fflate";

export const ISUN = "https://eumis2020.government.bg";
const TIMEOUT_MS = 30_000;

export type IsunListKind = "open" | "nims" | "discussion";

export type IsunListItem = {
  id: string;
  kind: "open" | "discussion";
  source: "isun" | "isun_nims";
  guid: string;
  code: string | null;
  title: string;
  programme: string | null;
  url: string;
};

export type IsunInfo = {
  aim: string | null;
  startsAt: string | null;
  deadlineAt: string | null;
  /** „Индикативна дата на обявяване“ при процедури на обсъждане. */
  indicativeDate: string | null;
  managingAuthorityUrl: string | null;
  documents: { name: string; url: string; key: string | null }[];
  /** Целият текст на страницата — за AI, когато няма PDF. */
  text: string;
};

const LISTS: Record<IsunListKind, string> = {
  open: "/bg/s/Procedure/Active",
  nims: "/bg/s/ProcedureNims/Active",
  discussion: "/bg/s/Procedure/PublicDiscussion",
};

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
};

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "")
      .replace(/<br\s*\/?>|<\/(p|div|li|h\d|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

async function get(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "porachkite.com/1.0 (+https://porachkite.com)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ИСУН: ${res.status} за ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBinary(url: string, maxBytes = 15_000_000): Promise<{ bytes: Buffer; type: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} за ${url}`);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error(`файлът е твърде голям (${bytes.length} байта)`);
    return { bytes, type: res.headers.get("content-type") ?? "" };
  } finally {
    clearTimeout(timer);
  }
}

/** „BG16RFPR001-2.003 -  Въвеждане на зелени технологии в МСП“ → код + заглавие. */
function splitCode(text: string) {
  const t = text.replace(/\s+/g, " ").trim();
  const m = t.match(/^([A-Z]{2,}[A-Z0-9]*-\d+(?:\.\d+)*)\s*-\s*(.+)$/);
  return m ? { code: m[1], title: m[2].trim() } : { code: null, title: t };
}

export async function listIsun(kind: IsunListKind): Promise<IsunListItem[]> {
  const html = await get(ISUN + LISTS[kind]);
  const items: IsunListItem[] = [];
  // Дървото е „<li> Програма … (N) <ul> <li data-href=…>КОД - заглавие</li> … </ul>“.
  // Минаваме последователно: текст на група преди <ul> = текуща програма.
  const tokenRe =
    /<li[^>]*class="[^"]*active-node[^"]*"[^>]*>\s*([^<]+?)\s*<ul>|<li[^>]*data-href="(\/bg\/s\/[A-Za-z]+\/[A-Za-z]+\/([0-9a-fA-F-]{36}))"[^>]*>\s*([\s\S]*?)<\/li>/g;
  let programme: string | null = null;
  for (const m of html.matchAll(tokenRe)) {
    if (m[1]) {
      programme = decodeEntities(m[1]).replace(/\s*\(\d+\)\s*$/, "").trim();
      continue;
    }
    const href = m[2];
    const guid = m[3].toLowerCase();
    const { code, title } = splitCode(decodeEntities(m[4].replace(/<[^>]+>/g, " ")));
    items.push({
      id: `isun:${guid}`,
      kind: kind === "discussion" ? "discussion" : "open",
      source: kind === "nims" ? "isun_nims" : "isun",
      guid,
      code,
      title,
      programme: kind === "nims" ? programme ?? "Национални програми" : programme,
      url: ISUN + href,
    });
  }
  return items;
}

/** „10.11.2026 г. 16:30 ч.“ (българско време) → ISO в UTC. */
export function parseBgDateTime(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = s.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s*г\.)?(?:\s*(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, hh = "23", mm = "59"] = m;
  // Пробваме +03:00 (лятно) и +02:00 (зимно) и взимаме този, който дава
  // същия час в Europe/Sofia — без външна библиотека.
  for (const offset of ["+03:00", "+02:00"]) {
    const iso = `${y}-${mo}-${d}T${hh.padStart(2, "0")}:${mm}:00${offset}`;
    const date = new Date(iso);
    const local = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Sofia",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date);
    if (Number(local) === Number(hh)) return date.toISOString();
  }
  return new Date(`${y}-${mo}-${d}T${hh.padStart(2, "0")}:${mm}:00+02:00`).toISOString();
}

export async function fetchIsunInfo(item: IsunListItem): Promise<IsunInfo> {
  const html = await get(item.url);
  const text = htmlToText(html);
  const after = (label: string) => {
    const i = text.indexOf(label);
    if (i < 0) return null;
    return text.slice(i + label.length, i + label.length + 80).split("\n").find((l) => l.trim())?.trim() ?? null;
  };

  // Целта стои на реда след „КОД - заглавие“.
  let aim: string | null = null;
  if (item.code) {
    const i = text.indexOf(item.code);
    if (i >= 0) {
      const lines = text.slice(i).split("\n").slice(1, 4);
      aim = lines.find((l) => l.length > 40 && !/срок/i.test(l))?.trim() ?? null;
    }
  }

  const documents = [...html.matchAll(/<a[^>]+href="([^"]*InfoDownload[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => {
    const url = ISUN + decodeEntities(m[1]);
    return {
      name: decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(),
      url,
      key: url.match(/fileKey=([0-9a-f-]{36})/i)?.[1] ?? null,
    };
  });

  return {
    aim,
    startsAt: parseBgDateTime(after("Начален срок:")),
    deadlineAt: parseBgDateTime(after("Краен срок:")),
    indicativeDate: after("Индикативна дата на обявяване"),
    managingAuthorityUrl: after("Интернет адрес:"),
    documents,
    text,
  };
}

/** PDF-ът, от който AI вади бюджета и кандидатите: обявата, ако я има. */
export function announcementDoc(info: IsunInfo) {
  return (
    info.documents.find((d) => /обява|покана/i.test(d.name)) ??
    info.documents.find((d) => /условия за кандидатстване/i.test(d.name)) ??
    null
  );
}

/**
 * Част от обявите са Word (.docx), не PDF. DOCX е zip с word/document.xml —
 * взимаме текста от него, без да тегли отделна библиотека за Word.
 */
export function docxToText(bytes: Buffer): string | null {
  try {
    const files = unzipSync(new Uint8Array(bytes), { filter: (f) => f.name === "word/document.xml" });
    const xml = files["word/document.xml"];
    if (!xml) return null;
    return decodeEntities(
      strFromU8(xml)
        // Кодовете на полетата (съдържание, препратки) не са текст на документа.
        .replace(/<w:instrText[^>]*>[\s\S]*?<\/w:instrText>/g, "")
        .replace(/<\/w:p>/g, "\n")
        .replace(/<w:tab\/>/g, " ")
        .replace(/<[^>]+>/g, ""),
    )
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n+/g, "\n")
      .trim();
  } catch {
    return null;
  }
}
