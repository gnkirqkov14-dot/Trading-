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

/**
 * Обявленията във формат eForms са „етикет на един ред, стойност на
 * следващия“: „Изисква се гаранция за участие(BT-751-Lot)“ / „не“. Ако
 * моделът цитира само етикета, цитатът е верен, но подвежда — добавяме
 * стойността от следващия ред (и мерната единица, ако стойността е число).
 */
function withEformsValue(text: string, lines: string[]) {
  if (!/\(BT-[^)]+\)\s*$/.test(text)) return text;
  const want = normalizeForMatch(text);
  const i = lines.findIndex((l) => normalizeForMatch(l).endsWith(want));
  if (i < 0 || i + 1 >= lines.length) return text;
  const value = lines[i + 1].trim();
  const unit = /^[\d.,\s]+$/.test(value) && i + 2 < lines.length ? ` ${lines[i + 2].trim()}` : "";
  return `${text} ${value}${unit}`;
}

export function makeQuoteChecker(source: string) {
  const haystack = normalizeForMatch(source);
  const lines = source.split("\n").filter((l) => l.trim());
  return (raw: string | null | undefined): Quote | null => {
    const text = withEformsValue((raw ?? "").replace(/\s+/g, " ").trim(), lines);
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
  // Дата (12.10.2026) | хиляди с интервал (138 495,00) или с точка
  // (1.000.000) | обикновено число (70, 1,2). „20, 30 и 50“ са три числа.
  const re =
    /\d{1,2}\.\d{1,2}\.\d{4}|\d{1,3}(?:[ \u00A0\u202F]\d{3})+(?:[.,]\d+)?|\d{1,3}(?:\.\d{3}){2,}(?:,\d+)?|\d+(?:[.,]\d+)?/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const date = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    const pieces = date ? [date[1], date[2], date[3]] : [raw];
    for (const piece of pieces) {
      let canon = piece.replace(/[\s\u00A0\u202F]/g, "");
      if (/^\d{1,3}(\.\d{3}){2,}/.test(canon)) canon = canon.replace(/\.(?=\d{3})/g, "");
      canon = canon.replace(/[.,]0+$/, "").replace(",", ".");
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
