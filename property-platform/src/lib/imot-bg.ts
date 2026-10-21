import "server-only";

import type { PropertyType } from "@/lib/types/database";

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

/** &#127969; → 🏡, &amp; → &. Без това описанията излизат с голи кодове. */
function decodeEntities(value: string) {
  const imena: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    laquo: "«",
    raquo: "»",
    ndash: "–",
    mdash: "—",
    hellip: "…",
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (цяло, име) => imena[име.toLowerCase()] ?? цяло);
}

function clean(value: string | undefined | null) {
  if (!value) return null;
  return (
    decodeEntities(value.replace(/<[^>]*>/g, " "))
      .replace(/\s+/g, " ")
      .trim() || null
  );
}

/**
 * Описанието, запазено както продавачът го е написал.
 *
 * Отделно от `clean`, защото там всичко бяло се слива в интервали. В
 * описанието редовете носят смисъл: „Локация: …“, „Площ: …“, „Етаж: …“
 * са отделни редове и слети в един абзац стават каша. Страницата на
 * обявата ги показва с `whitespace-pre-wrap`.
 */
function cleanDescription(value: string | undefined | null) {
  if (!value) return null;
  const text = decodeEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]*>/g, " "),
  );
  return (
    text
      .replace(/[ \t\u00a0]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
}

function digits(value: string | null) {
  if (!value) return null;
  const n = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ImotListing = {
  sourceUrl: string;
  title: string | null;
  /** „naem“ в адреса значи наем — цената тогава е на месец. */
  dealType: "sale" | "rent";
  priceEur: number | null;
  areaSqm: number | null;
  rooms: number | null;
  floor: number | null;
  floorsTotal: number | null;
  /** Населеното място от заглавието — вече не само Пловдив. */
  city: string | null;
  /** true при „в село …“. Имената се повтарят между градове и села. */
  isVillage: boolean;
  /** Улица и номер, когато продавачът ги е попълнил. */
  street: string | null;
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
   * Видът имот, познат по адреса на обявата.
   *
   * null значи „не е от видовете, които платформата описва“ — склад,
   * заведение, гараж. Такава обява се пропуска, вместо да влезе под
   * чужд вид: склад, записан като апартамент, е лъжа към купувача.
   */
  propertyType: PropertyType | null;
  /**
   * Кой подава обявата според самата страница.
   *
   * Това е предпазителят срещу агенции: филтърът в imot.bg живее в сесията
   * на потребителя и не пътува с адреса, затова не бива да му се вярва.
   * Маркерът е в самата обява и не лъже.
   */
  sellerKind: "builder" | "investor" | "agency" | "private" | "unknown";
};

/** „…-prodava-tristaen-apartament-grad-plovdiv-…“ → apartment. */
function propertyTypeFromUrl(url: string): PropertyType | null {
  const slug = url.toLowerCase();
  if (/-apartament-|-atelie-|-mezonet-/.test(slug)) return "apartment";
  if (/-kashta-|-vila-|-etazh-ot-kashta-/.test(slug)) return "house";
  if (/-magazin-/.test(slug)) return "shop";
  if (/-ofis-/.test(slug)) return "office";
  if (/-parcel-|-zemedelska-zemya-|-industrialen-teren-/.test(slug))
    return "plot";
  return null;
}

/** „2-СТАЕН“ → 2, „МНОГОСТАЕН“ → 4 (повече от 3, точният брой не се казва). */
function roomsFromTitle(title: string | null) {
  if (!title) return null;
  const m = title.match(/(\d)\s*-?\s*СТАЕН/i);
  if (m) return Number(m[1]);
  if (/МНОГОСТАЕН/i.test(title)) return 4;
  return null;
}

/**
 * Маха телефоните и имейлите от описанието.
 *
 * Те вече стоят в „Контакти“, където им е мястото и където ще ги пази
 * преградата за регистрация. Повторени в текста, същите номера я
 * заобикалят — а и правят описанието по-дълго без полза.
 *
 * Маха се и подканата, която ги е въвела („Свържете се с нас за…:“),
 * защото без номерата под нея увисва.
 */
export function bezKontakti(opis: string | null) {
  if (!opis) return null;
  // С код на държавата разделителите може да са навсякъде — „+359 88 906
  // 6644“ се пише и така. Без код шаблонът остава стегнат, защото в
  // текста има цени и квадратури, които при хлабав шаблон минават за номер.
  // Стационарните („+359 2 426 1244“, „02 …“) минаваха: шаблонът беше
  // само за мобилни. При водеща 0 без точки — иначе хваща дати.
  const nomer =
    /\(?\+ ?359\)?[\s.-]{0,2}(?:8[\s.-]?[789]|9[\s.-]?[89])(?:[\s.-]?\d){7}|0(?:8[789]|9[89])\d(?:[\s.-]?\d){6}|(?:\+\s?359|\(\+?359\))(?:[\s./()-]{0,2}\d){8,9}|(?<!\d)0[2-9](?:[ /-]{0,2}\d){7,8}(?!\d)/g;
  // Изречение, което сочи към вече махнатите номера, увисва без тях.
  const sochi =
    /[^.!?\n]*(?:посочени\S*\s+(?:по-долу\s+)?(?:телефон|номер)|обадете се[^.!?\n]{0,20}\bтел\.)[^.!?\n]*[.!?]?/gi;
  // Етикет без стойност: „Офис мениджър - /“, „📞 Тел.:“.
  const prazenEtiket =
    /^(?:[^\n]{0,40}(?:^|[\s(])(?:офис|мениджър|телефон|тел|gsm|мобилен|централен|централа)(?=[\s.:-])[^\n]{0,20}[-–:][\s/,.]*|[^\p{L}\p{N}]*(?:тел|телефон|gsm)\.?\s*:?[\s.,]*)$/iu;
  const imeyl = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

  // imot.bg крие имейлите като „[email protected]“, а сайта на фирмата дава
  // като поддомейн на imot.bg. Редът с тях е само контакт — маха се целият.
  const skrit = /email\s*protected|[a-z0-9-]+\.imot\.bg/i;

  const redove = opis
    .split("\n")
    .filter((red) => !(skrit.test(red) && red.length < 200))
    .map((red) =>
      red
        .replace(sochi, "")
        .replace(nomer, "")
        .replace(imeyl, "")
        .replace(/\s{2,}/g, " ")
        .trim(),
    )
    // Етикетът остава без номера си, подканата с двоеточие — също.
    .map((red) =>
      prazenEtiket.test(red) ||
      /(?:свържете|обадете)[^\n]{0,60}:\s*$/i.test(red)
        ? ""
        : red,
    )
    // Ред, в който е имало само номер, вече е празен или само пунктуация.
    .filter((red, i, vsichki) => {
      const prazen = /^[\s•·.,;:()\-–—]*$/.test(red);
      if (!prazen) return true;
      // Един празен ред между абзаци се пази, поредица от тях — не.
      return red === "" && vsichki[i - 1] !== "";
    });

  // Подканата накрая, останала без номера под себе си.
  while (
    redove.length &&
    (/^[^\n]{0,80}(обадете|свържете|контакт|оферта|наличности|имейл|e-?mail)[^\n]{0,40}:?\s*$/i.test(
      redove[redove.length - 1],
    ) ||
      /^[^\n]{0,60}информация\s*:[\s,]*$/i.test(redove[redove.length - 1]))
  ) {
    redove.pop();
  }

  return (
    redove
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim() || null
  );
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

  // Адресът често стои в текста, а не в полето: „…, ул. Васил Петлешков
  // 16, с АКТ 16, …“. Купувачът го вижда, значи и адресът на обявата
  // трябва да го показва, вместо да го крие в описанието.
  //
  // Две неща се пропускат нарочно:
  //   „нашия офис на бул. Пещерско шосе 157“ — това е офисът на фирмата
  //   „в близост до ул. Х“          — това е ориентир, не адрес
  const streetFromDescription = (opis: string | null) => {
    if (!opis) return null;
    const re =
      /((?:ул|бул)\.\s*[„"]?[А-ЯA-Z][А-Яа-яA-Za-z0-9\s.-]{2,34}?\s*№?\s*\d{1,4}[А-Яа-я]?)(?=[\s,.;)]|$)/g;
    for (const m of opis.matchAll(re)) {
      // Гледа се само това, което стои НЕПОСРЕДСТВЕНО преди улицата —
      // до последната запетая. Иначе „в непосредствена близост до Събота
      // пазара, ул. Васил Петлешков 16“ отпада, а там улицата след
      // запетаята е точно адресът на имота.
      const predi = opis.slice(Math.max(0, (m.index ?? 0) - 45), m.index);
      const plътno = predi.slice(predi.lastIndexOf(",") + 1);
      if (/офис|близост до|срещу|сградата на|до\s*$/i.test(plътno)) continue;
      return clean(m[1]);
    }
    return null;
  };

  const description = bezKontakti(
    cleanDescription(
      text.match(
        /Описание(?:\s*на имота)?:?([\s\S]{0,4000}?)(?:За контакти|Особености|ЗА КОНТАКТ)/i,
      )?.[1],
    ),
  );

  // Телефоните са пръснати на няколко места в страницата; събираме всички
  // български мобилни и ги подреждаме по реда на срещане.
  // Само истински български мобилни (087/088/089/098/099). По-широкият
  // шаблон „0[89]…“ лови числа от текста — цени, квадратури, кодове — и в
  // обявата влиза телефон, на който никой не отговаря.
  const phones = [
    ...new Set(
      (text.match(/0(?:8[789]|9[89])\d[\s-]?\d{3}[\s-]?\d{3}/g) ?? []).map(
        (p) => p.replace(/[\s-]/g, ""),
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
      // Предпочита се най-големият вариант: 280×209 (без папка),
      // 800×598 (/big) и 1230×920 (/big1). Смаляваме ние, но по-голям
      // изходен файл дава по-чист резултат.
      const tegло = (u: string) =>
        /\/big1\//.test(u) ? 2 : /\/big\//.test(u) ? 1 : 0;
      const current = byFile.get(file);
      if (!current || tegло(full) > tegло(current)) {
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
        : /Частно лице\s*[:/,]|\/\s*Частно лице/i.test(text)
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
  // „Продава 2-СТАЕН в град Пловдив, Каменица 2 - 66 кв.м / …“
  //
  // Заглавието е единственото място, където населеното място и кварталът
  // стоят заедно и в този ред. Същият израз, пуснат върху тялото на
  // страницата, лови съседен текст: за обява в Каменица 2 оттам излезе
  // „Христо Смирненски“, съвсем друг квартал.
  // Най-надеждният източник: самата страница има ред
  //   Местоположение: <b>град Пловдив, Каменица 2, бул.6-ти Септември 239</b>
  // В него стоят населеното място, кварталът и — когато продавачът го е
  // попълнил — улицата с номера. Заглавието носи само първите две.
  const redMestopolozhenie = (() => {
    const m = html.match(/Местоположение:\s*<b>([^<]{4,160})<\/b>/i);
    if (!m) return null;
    const chasti = m[1]
      .split(",")
      .map((c) => clean(c))
      .filter(Boolean) as string[];
    if (chasti.length === 0) return null;

    const prvo = chasti[0].match(/^(град|село)\s+(.+)$/);
    if (!prvo) return null;

    // Третата част НЕ е непременно улица.
    //
    // imot.bg слага там и подрайон: „град Пловдив, Гагарин, Северен“ или
    // „…, Христо Смирненски, Пещерско шосе, западен“. Записани като адрес,
    // излизат „Северен, кв. Гагарин“ — което не е адрес, а бъркотия.
    //
    // За улица се брои само това, което почва с „ул.“ или „бул.“.
    const eUlica = (t: string) => /^(ул|бул)\.?\s*[А-Яа-яA-Za-z0-9]/i.test(t);

    const ostatak = chasti.slice(1);
    const kvartal =
      ostatak.length && !eUlica(ostatak[0]) ? ostatak.shift()! : null;
    const ulica = ostatak.find(eUlica) ?? null;

    return {
      selo: prvo[1] === "село",
      ime: clean(prvo[2]),
      kvartal,
      ulica,
    };
  })();

  const otZaglavie = (() => {
    // Без \b пред „в“: границата на дума в JS се мери по латиница и пред
    // кирилско „в“ изобщо не съвпада.
    //
    // Краят се закотвя за „ - <число> кв“, а не за първото тире: има
    // квартали с тире в името („Индустриална зона - Тракия“).
    const krai = "\\s*(?:,\\s*(.{2,40}?))?\\s*-\\s*[\\d.,\\s]+\\s*кв";

    // Областният център се пише „в град Пловдив, Каменица 2 - …“,
    // а всичко останало в областта — „в област Пловдив, гр. Асеновград - …“.
    const pryako = title?.match(
      new RegExp(`(?:^|\\s)в\\s+(град|село)\\s+([^,]{2,40}?)${krai}`),
    );
    if (pryako) {
      return {
        selo: pryako[1] === "село",
        ime: clean(pryako[2]),
        kvartal: clean(pryako[3] ?? null),
      };
    }

    const prezOblast = title?.match(
      new RegExp(
        `(?:^|\\s)в\\s+област\\s+[^,]{2,30},\\s*(гр|с)\\.\\s*([^,]{2,40}?)${krai}`,
      ),
    );
    if (prezOblast) {
      return {
        selo: prezOblast[1] === "с",
        ime: clean(prezOblast[2]),
        kvartal: clean(prezOblast[3] ?? null),
      };
    }

    return null;
  })();

  // Редът „Местоположение“ бие заглавието: той е полето, не текст.
  const mqsto = redMestopolozhenie ?? otZaglavie;

  const floorPart = floorLine?.split(",")[0] ?? null;
  const floorMatch = floorPart?.match(/(\d+|Партер)\s*(?:от\s*(\d+))?/i);
  const restOfLine = floorLine?.split(",").slice(1).join(",").trim() || null;

  return {
    sourceUrl: url,
    title,
    dealType: /-naem-/i.test(url) ? "rent" : "sale",
    // Цената и квадратурата се четат ОТ ЗАГЛАВИЕТО, не от страницата.
    //
    // „…, Център - 73 кв.м / При запитване, ГЕРТ ГРУП“ — когато фирмата
    // не обявява цена, в тялото на страницата първото число с € е от
    // страничния списък „други обяви“, тоест цена на чужд имот. Така в
    // сайта влизаше апартамент за 77 980 €, каквато цена никой не е
    // обявявал. По-добре обявата да отпадне, отколкото да лъже цена.
    priceEur: digits(
      clean(title?.match(/кв\.?\s*м\s*\/\s*([\d\s]{3,})\s*€/)?.[1] ?? null),
    ),
    areaSqm: digits(
      clean(title?.match(/-\s*(\d+(?:[.,]\d+)?)\s*кв\.?\s*м/)?.[1] ?? null),
    ),
    rooms: roomsFromTitle(title),
    floor: floorMatch
      ? /партер/i.test(floorMatch[1])
        ? 0
        : Number(floorMatch[1])
      : null,
    floorsTotal: floorMatch?.[2] ? Number(floorMatch[2]) : null,
    city: mqsto?.ime ?? null,
    isVillage: mqsto?.selo ?? false,
    neighborhood: mqsto?.kvartal ?? null,
    street:
      (mqsto as { ulica?: string | null } | null)?.ulica ??
      streetFromDescription(description),
    description,
    company,
    phones,
    photos,
    constructionNote: constructionLine ?? restOfLine,
    commissionYear: commissionYearMatch ? Number(commissionYearMatch[1]) : null,
    commissioned,
    propertyType: propertyTypeFromUrl(url),
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
  if (
    /акт\s*16|въведен[а]? в експлоатация|разрешение за ползване/.test(haystack)
  ) {
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
