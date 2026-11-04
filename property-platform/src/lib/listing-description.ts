// Keep contact information in the listing's dedicated contact fields.
const PHONE = /(?<![\p{L}\p{N}])(?:(?:\+|00)[1-9](?:[ \t()./-]*\d){7,14}|0(?:[ \t()./-]*\d){8,9}|8[789](?:[ \t()./-]*\d){7})(?![\p{L}\p{N}])/gu;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,63}/giu;
const WEBSITE = /(?:https?:\/\/|www\.)[^\s<>"'\])}]+|(?<![@\p{L}\p{N}_])(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(?:[a-z]{2,63}|бг|рф)(?::\d{2,5})?(?:[/?#][^\s<>"'\])}]*)?/giu;
const CONTACT_WORDS = new Set([
  "тел", "телефон", "телефони", "моб", "мобилен", "номер", "номера", "gsm", "phone",
  "сайт", "сайта", "уеб", "уебсайт", "website", "web", "email", "mail", "имейл",
  "за", "на", "и", "или", "от", "с", "нас", "ни", "наш", "нашия", "нашият",
  "връзка", "контакт", "контакти", "собственик", "моля", "звънете", "позвънете",
  "обадете", "се", "оглед", "огледи", "информация", "повече", "подробности",
  "вижте", "посетете", "пишете", "viber", "вайбър", "whatsapp", "ватсап",
]);

/** Къде в текста има телефон, имейл или сайт: [начало, край] за всяко. */
export function kontaktiVTekst(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const izraz of [PHONE, EMAIL, WEBSITE]) {
    for (const m of text.matchAll(new RegExp(izraz.source, izraz.flags))) {
      // Нашият знак „imotpoint.com“ стои на всяка снимка.
      if (/imotpoint/i.test(m[0])) continue;
      out.push([m.index, m.index + m[0].length]);
    }
  }
  return out;
}

export function cleanListingDescription(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\r\n?/g, "\n").split("\n").map(line => {
    const original = line;
    line = line.replace(/!?\[[^\]\n]*\]\(\s*(?:https?:\/\/|www\.)[^)\n]+\)/gi, "");
    line = line.replace(EMAIL, "").replace(WEBSITE, "").replace(PHONE, "");
    if (line !== original) {
      const words = line.toLocaleLowerCase("bg").match(/\p{L}+/gu) ?? [];
      if (words.every(word => CONTACT_WORDS.has(word)) && !/\d/.test(line)) return "";
      line = line.replace(/(?:тел(?:ефон)?\.?|gsm|phone|сайт|уебсайт|website|e-?mail|имейл)(?:[ \t]+(?:за[ \t]+)?(?:връзка|контакт))?[ \t]*[:–-]?[ \t]*(?=[,;.!?]|$)/giu, "");
      line = line.replace(/\(\s*\)|\[\s*\]|<\s*>/g, "").replace(/[ \t]+([,.;!?])/g, "$1").replace(/(?:[,;][ \t]*){2,}/g, ", ");
    }
    return line.replace(/[ \t]{2,}/g, " ").trim();
  }).join("\n").replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, "\n\n").trim();
}
