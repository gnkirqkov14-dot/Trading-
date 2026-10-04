import type { Quote } from "./types";

/**
 * Проверка на цитатите от AI срещу официалния текст. Моделът може да
 * перифразира или да сбърка цифра; затова всяко изискване идва с дословен
 * откъс и кодът проверява, че откъсът наистина го има в обявлението.
 * Сравнява се след изравняване на интервали, кавички и тирета — те се
 * различават между HTML-а на ЦАИС и отговора на модела, без да менят смисъла.
 * Цифрите и думите трябва да съвпадат точно.
 */
export function normalizeForMatch(s: string) {
  return s
    .normalize("NFC")
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/[\u201E\u201C\u201D"\u00AB\u00BB\u2018\u2019'`]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

export function makeQuoteChecker(source: string) {
  const haystack = normalizeForMatch(source);
  return (raw: string | null | undefined): Quote | null => {
    const text = (raw ?? "").replace(/\s+/g, " ").trim();
    if (!text) return null;
    // Моделът понякога съединява два откъса с „…“ — тогава всеки трябва да
    // го има, в същия ред.
    const parts = text
      .split(/\s*(?:\.\.\.|…|\[\.\.\.\])\s*/)
      .map(normalizeForMatch)
      .filter((p) => p.length > 0);
    let from = 0;
    // Твърде къс откъс („ЦПРС“) се намира навсякъде и нищо не доказва.
    let verified = parts.length > 0 && parts.every((p) => p.length >= 12);
    for (const part of parts) {
      const at = haystack.indexOf(part, from);
      if (at < 0) {
        verified = false;
        break;
      }
      from = at + part.length;
    }
    return { text, verified };
  };
}

/**
 * Числата в текста на модела (суми, години, кв. м, проценти) трябва да ги
 * има и в обявлението. Сравняват се без разделители за хилядите и без
 * нулеви десетични: „138 495,00“ = „138495.00“ = „138 495“.
 */
function numberTokens(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\d(?:[\d\u00A0\u202F .,]*\d)?/g)) {
    const raw = m[0].trim();
    // Дати като 12.10.2026 — по части.
    const date = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const pieces = date ? [date[1], date[2], date[3]] : [raw];
    for (const piece of pieces) {
      const canon = piece
        .replace(/[.,]0+$/, "")
        .replace(/[\s\u00A0\u202F]/g, "")
        .replace(/[.,](?=\d{3}(?:\D|$))/g, "")
        .replace(",", ".");
      out.push(canon.replace(/^0+(?=\d)/, ""));
    }
  }
  return out;
}

export function makeNumberChecker(source: string) {
  const known = new Set(numberTokens(source));
  return (text: string | null | undefined): string[] => {
    const missing = new Set<string>();
    for (const n of numberTokens(text ?? "")) {
      // Едноцифрените (1, 3, 5) са навсякъде — не носят информация.
      if (n.replace(/\D/g, "").length < 2) continue;
      if (!known.has(n)) missing.add(n);
    }
    return [...missing];
  };
}
