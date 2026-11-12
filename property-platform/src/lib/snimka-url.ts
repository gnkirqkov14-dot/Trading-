/**
 * Проверки на адресите, които формата за обява праща към сървъра.
 *
 * Снимките се качват от браузъра направо в хранилището и сървърът получава
 * само адресите им. Без проверка някой може да прати чужд адрес: той ще
 * се запише в обявата и сървърът ще го изтегли, за да търси телефон върху
 * снимката. Затова приемаме само адреси от нашата кофа `listing-photos`.
 */

const KOFA = "/storage/v1/object/public/listing-photos/";

function nachalo() {
  const baza = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  return baza ? baza + KOFA : null;
}

/** Адресът сочи към нашата кофа за снимки (без значение чия папка). */
export function eNashaSnimka(url: string) {
  const n = nachalo();
  if (!n || typeof url !== "string" || !url.startsWith(n)) return false;
  const pat = url.slice(n.length);
  if (!pat || /[?#\\]/.test(pat)) return false;
  let chist: string;
  try {
    chist = decodeURIComponent(pat);
  } catch {
    return false;
  }
  return !chist.split("/").some((chast) => chast === ".." || chast === ".");
}

/** Адресът е на наша снимка и е в папката на този потребител. */
export function eSnimkaNaPotrebitel(url: string, userId: string) {
  return eNashaSnimka(url) && url.slice(nachalo()!.length).startsWith(`${userId}/`);
}

/** Линк към видео: само обикновен https адрес, до 500 знака. */
export function eVideoLink(url: string) {
  if (typeof url !== "string" || url.length > 500) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
