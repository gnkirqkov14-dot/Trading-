import "server-only";

/**
 * Разчита една обява от imot.bg.
 *
 * Защо от сървъра, а не от браузъра: страницата е от чужд домейн, браузърът
 * няма да я даде заради CORS. Сървърът я тегли без проблем.
 *
 * Защо изобщо от imot.bg, а не от сайта на строителя: проверено е — сайтовете
 * на строителите показват проекта („130 обекта, 12–226 м²“), но не и отделния
 * апартамент с цена. Конкретните обяви живеят в imot.bg и там се поддържат
 * актуални.
 *
 * Тегли се ЕДНА страница по команда на администратора, не обхождане на сайта.
 */

/** Страницата е в кирилица windows-1251, не UTF-8. Четена като UTF-8 излиза боклук. */
function decodeCyrillic(buffer: ArrayBuffer) {
  return new TextDecoder("windows-1251").decode(buffer);
}

function clean(value: string | undefined | null) {
  return value?.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim() || null;
}

function digits(value: string | null) {
  if (!value) return null;
  const n = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ImotListing = {
  sourceUrl: string;
  title: string | null;
  priceEur: number | null;
  areaSqm: number | null;
  rooms: number | null;
  floor: number | null;
  floorsTotal: number | null;
  neighborhood: string | null;
  description: string | null;
  /** Името на строителната фирма, както е изписано в обявата. */
  company: string | null;
  phones: string[];
  photos: string[];
  /** Суровият ред за строителството — оттам се чете етапът. */
  constructionNote: string | null;
  /** Годината от реда за експлоатация, без значение минала или бъдеща. */
  commissionYear: number | null;
  /** true, когато сградата вече Е въведена в експлоатация. */
  commissioned: boolean;
  /**
   * Кой подава обявата според самата страница.
   *
   * Това е предпазителят срещу агенции: филтърът в imot.bg живее в сесията
   * на потребителя и не пътува с адреса, затова не бива да му се вярва.
   * Маркерът е в самата обява и не лъже.
   */
  sellerKind: "builder" | "investor" | "agency" | "private" | "unknown";
};

/** „2-СТАЕН“ → 2, „МНОГОСТАЕН“ → 4 (повече от 3, точният брой не се казва). */
function roomsFromTitle(title: string | null) {
  if (!title) return null;
  const m = title.match(/(\d)\s*-?\s*СТАЕН/i);
  if (m) return Number(m[1]);
  if (/МНОГОСТАЕН/i.test(title)) return 4;
  return null;
}

export async function fetchImotListing(url: string): Promise<ImotListing> {
  if (!/^https:\/\/(www\.)?imot\.bg\/obiava-/i.test(url)) {
    throw new Error("Адресът не е обява от imot.bg.");
  }

  const response = await fetch(url, {
    headers: {
      // Без правдоподобен браузър imot.bg връща друга страница.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      "Accept-Language": "bg,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`imot.bg върна ${response.status}.`);
  }

  const html = decodeCyrillic(await response.arrayBuffer());
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ");

  const title = clean(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);

  const grab = (re: RegExp) => clean(text.match(re)?.[1]);

  const description = clean(
    text.match(/Описание(?:\s*на имота)?:?([\s\S]{0,4000}?)(?:За контакти|Особености|ЗА КОНТАКТ)/i)?.[1],
  );

  // Телефоните са пръснати на няколко места в страницата; събираме всички
  // български мобилни и ги подреждаме по реда на срещане.
  // Само истински български мобилни (087/088/089/098/099). По-широкият
  // шаблон „0[89]…“ лови числа от текста — цени, квадратури, кодове — и в
  // обявата влиза телефон, на който никой не отговаря.
  const phones = [
    ...new Set(
      (text.match(/0(?:8[789]|9[89])\d[\s-]?\d{3}[\s-]?\d{3}/g) ?? []).map((p) =>
        p.replace(/[\s-]/g, ""),
      ),
    ),
  ].filter((p) => p.length === 10);

  // Името на фирмата стои най-надеждно в заглавието, точно преди „:: imot.bg“.
  // В тялото на страницата „Строителна фирма:“ е залепено за съседни полета и
  // регулярният израз лесно отхапва чужд текст.
  const company =
    clean(title?.match(/,\s*([^,]+?)\s*::\s*imot\.bg/i)?.[1] ?? null) ??
    grab(/Строителна фирма:\s*([А-ЯA-Z][^<\n,]{2,60})/);

  // Снимките носят номера на обявата в името на файла — така се отсяват
  // чуждите кадри от страничните блокове „подобни обяви“.
  const id = url.match(/obiava-([0-9a-z]+)-/i)?.[1];
  // Един кадър се среща по няколко пъти — малък, /big/ и /big1/. Групираме по
  // името на файла и взимаме най-голямото копие, иначе в обявата влизат
  // дубликати в лошо качество.
  const byFile = new Map<string, string>();
  if (id) {
    for (const src of html.match(/\/\/[^"'\s]+\.(?:jpg|jpeg|png)/gi) ?? []) {
      if (!src.includes(id)) continue;
      const file = src.split("/").pop()!;
      const full = `https:${src.replace(/([^:])\/\//g, "$1/")}`;
      const current = byFile.get(file);
      if (!current || (/\/big\d?\//.test(full) && !/\/big\d?\//.test(current))) {
        byFile.set(file, full);
      }
    }
  }
  const photos = [...byFile.values()];

  // Редът е от вида „Етаж: Партер от 4, Тухла, Ще бъде въведен в експлоатация
  // 2027 г.“ — етажът е до първата запетая, останалото е за етапа.
  const sellerKind: ImotListing["sellerKind"] = /Строителна фирма:/i.test(text)
    ? "builder"
    : /Инвеститор:/i.test(text)
      ? "investor"
      : /Агенция:/i.test(text)
        ? "agency"
        : /Частно лице:/i.test(text)
          ? "private"
          : "unknown";

  const constructionLine = grab(/Строителство:?\s*([^<\n]{0,90})/i);
  const floorLine = grab(/Етаж:?\s*([^<\n]{0,90})/i);
  // Редът е от вида „5-ти от 6, Тухла, Ще бъде въведен в експлоатация 2026 г.“
  // и носи три различни изречения:
  //   „Ще бъде въведен …“      — още се строи, годината е обещание
  //   „Въведен в експлоатация“ — готов е, годината е факт
  //   „Не е въведен …“         — още се строи, година не се казва
  const commissionLine = `${floorLine ?? ""} ${constructionLine ?? ""}`;
  const commissionYearMatch = commissionLine.match(
    /въведен[а]?\s+в\s+експлоатация\s*(20\d\d)/i,
  );
  const commissioned =
    /въведен[а]?\s+в\s+експлоатация/i.test(commissionLine) &&
    !/(?:ще\s+бъде|не\s+е|предстои|очаква)\s+(?:[а-я]+\s+)?въведен/i.test(
      commissionLine,
    );
  const floorPart = floorLine?.split(",")[0] ?? null;
  const floorMatch = floorPart?.match(/(\d+|Партер)\s*(?:от\s*(\d+))?/i);
  const restOfLine = floorLine?.split(",").slice(1).join(",").trim() || null;

  return {
    sourceUrl: url,
    title,
    priceEur: digits(grab(/([\d\s]{4,})\s*(?:EUR|€|Евро)/i)),
    areaSqm: digits(grab(/(\d+[.,]?\d*)\s*кв\.?\s*м/i)),
    rooms: roomsFromTitle(title),
    floor: floorMatch
      ? /партер/i.test(floorMatch[1])
        ? 0
        : Number(floorMatch[1])
      : null,
    floorsTotal: floorMatch?.[2] ? Number(floorMatch[2]) : null,
    // Кварталът се чете първо от заглавието: „… в град Пловдив, Каменица 2 -
    // 66 кв.м …“. Същият израз, пуснат върху тялото на страницата, лови
    // съседен текст — за обява в Каменица 2 оттам излезе „Христо Смирненски“,
    // съвсем друг квартал. Тялото остава само за заглавия без град.
    neighborhood:
      clean(title?.match(/град Пловдив,\s*([^-]{2,40}?)\s*-/)?.[1] ?? null) ??
      grab(/град Пловдив,?\s*([А-Яа-я\s-]{3,30}?)\s*(?:-|,|::|<)/),
    description,
    company,
    phones,
    photos,
    constructionNote: constructionLine ?? restOfLine,
    commissionYear: commissionYearMatch
      ? Number(commissionYearMatch[1])
      : null,
    commissioned,
    sellerKind,
  };
}

/** Етапът, доколкото обявата го казва. Останалото се избира на ръка. */
export function guessStage(note: string | null, description: string | null) {
  const haystack = `${note ?? ""} ${description ?? ""}`.toLowerCase();

  // Отрицанието се проверява ПЪРВО. И „Ще бъде въведен в експлоатация
  // 2027 г.“, и „Не е въведен в експлоатация“ съдържат „въведен в
  // експлоатация“ и инак минават за Акт 16 — тоест готов имот, какъвто
  // не е. Грешен етап пред купувач е по-лошо от липсващ.
  if (
    /не\s+е\s+въведен|ще\s+бъде|предстои|очаква се|новострояща|в строеж|в процес на строителство/.test(
      haystack,
    )
  ) {
    return "building" as const;
  }
  if (/акт\s*16|въведен[а]? в експлоатация|разрешение за ползване/.test(haystack)) {
    return "act16" as const;
  }
  if (/акт\s*15/.test(haystack)) return "act15" as const;
  if (/акт\s*14|груб строеж/.test(haystack)) return "act14" as const;
  return null;
}

/**
 * Вади адресите на всички обяви от една страница с резултати.
 *
 * Така внасянето спира да е „залепи адрес, повтори 40 пъти": сървърът чете
 * списъка, какъвто го е подредило самото търсене, с филтъра за строителни
 * фирми вътре в адреса.
 */
export async function collectImotUrls(searchUrl: string): Promise<string[]> {
  if (!/^https:\/\/(www\.)?imot\.bg\//i.test(searchUrl)) {
    throw new Error("Адресът не е от imot.bg.");
  }

  const response = await fetch(searchUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36",
      "Accept-Language": "bg,en;q=0.8",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`imot.bg върна ${response.status}.`);

  const html = decodeCyrillic(await response.arrayBuffer());

  // Интересуват ни само обявите за конкретен имот. Страницата сочи и към
  // цели сгради и комплекси (obiava-7507), които нямат цена и квадратура
  // на апартамент — те нямат работа в списък с имоти.
  const links = html.match(/\/obiava-[0-9a-z]+-[a-z0-9-]+/gi) ?? [];
  return [
    ...new Set(
      links
        .filter((href) => /prodava|naem/i.test(href))
        .map((href) => `https://www.imot.bg${href}`),
    ),
  ];
}
