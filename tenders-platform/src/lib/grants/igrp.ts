import { decodeEntities } from "./isun";

/**
 * Индикативните годишни работни програми (ИГРП) — планът на всяка
 * програма коя процедура кога ще се отвори, с бюджет, допустими кандидати
 * и размер на помощта. Оттук идват „предстоящите“ грантове.
 *
 * eufunds.bg пуска всяка версия (проект, изменение) като отделна новина с
 * прикачен PDF, затова не държим списък с адреси, а обхождаме общия списък
 * и за всяка програма взимаме най-новата новина за текущата и следващата
 * година. Капан: съседните години се смесват — затова годината се търси в
 * заглавието на новината, а не в датата ѝ.
 */

const EUFUNDS = "https://www.eufunds.bg";
const LIST = `${EUFUNDS}/bg/indicative-annual-work-programmes`;
const PAGES = 3;

/** Раздел на eufunds.bg → име на програмата. */
const PROGRAMMES: Record<string, string> = {
  opic: 'Програма "Конкурентоспособност и иновации в предприятията" 2021-2027',
  oprd: 'Програма "Развитие на регионите" 2021-2027',
  opos: 'Програма "Околна среда" 2021-2027',
  opseig: 'Програма "Образование" 2021-2027',
  optti: 'Програма "Транспортна свързаност" 2021-2027',
  pmdr: "Програма за морско дело, рибарство и аквакултури 2021-2027 г.",
  ophrd: 'Програма "Развитие на човешките ресурси" 2021-2027',
};

export type IgrpSource = {
  id: string;
  programme: string;
  year: number;
  pageUrl: string;
  pdfUrl: string;
  title: string;
};

async function get(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "porachkite.com/1.0 (+https://porachkite.com)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`eufunds.bg: ${res.status} за ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverIgrp(now = new Date()): Promise<IgrpSource[]> {
  const year = Number(new Intl.DateTimeFormat("en", { timeZone: "Europe/Sofia", year: "numeric" }).format(now));
  const wanted = [year, year + 1];
  const newest = new Map<string, { slug: string; year: number; pageUrl: string; title: string }>();

  for (let page = 0; page < PAGES; page++) {
    const html = await get(page ? `${LIST}?page=${page}` : LIST);
    // Новините идват от най-новата към най-старата: първата за дадена
    // програма и година е актуалната версия.
    for (const m of html.matchAll(/<a[^>]+href="(\/bg\/([a-z]+)\/node\/\d+)"[^>]*>\s*([^<]{10,300})<\/a>/g)) {
      const [, path, slug, rawTitle] = m;
      if (!(slug in PROGRAMMES)) continue;
      const title = decodeEntities(rawTitle).replace(/\s+/g, " ").trim();
      if (!/работна програма|ИГРП/i.test(title)) continue;
      // „2021-2027“ е част от името на програмата, не годината на плана.
      const yearsText = title.replace(/20\d\d\s*[-–]\s*20\d\d/g, "");
      const y = wanted.find((w) => yearsText.includes(String(w)));
      if (!y) continue;
      const key = `${slug}:${y}`;
      if (!newest.has(key)) newest.set(key, { slug, year: y, pageUrl: EUFUNDS + path, title });
    }
  }

  const sources: IgrpSource[] = [];
  for (const [key, n] of newest) {
    const html = await get(n.pageUrl);
    // Само PDF: Транспортна свързаност понякога качва .docx — тя не е за
    // фирми, затова не си струва отделен четец за Word.
    const pdf = html.match(/href="([^"]+\.pdf)"/i)?.[1];
    if (!pdf) continue;
    sources.push({
      id: `igrp:${key}`,
      programme: PROGRAMMES[n.slug],
      year: n.year,
      pageUrl: n.pageUrl,
      pdfUrl: pdf.startsWith("http") ? pdf : EUFUNDS + decodeEntities(pdf),
      title: n.title,
    });
  }
  return sources;
}
