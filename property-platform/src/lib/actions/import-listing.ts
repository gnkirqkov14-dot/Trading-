"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/dal";
import sharp from "sharp";
import { fetchImotListing, guessStage, type ImotListing } from "@/lib/imot-bg";
import type { PropertyType } from "@/lib/types/database";

/**
 * Внасяне на фирмена обява от imot.bg.
 *
 * Две отделни стъпки нарочно: `previewImotListing` само чете и показва, а
 * `importImotListing` записва. Между тях стои човек, който решава дали
 * фирмата е дала разрешение и дали данните са верни — това не е нещо, което
 * машина бива да решава сама.
 *
 * Снимките минават през нашето хранилище, а не се сочат към imot.bg:
 * чуждите адреси умират, щом обявата там бъде свалена, и дотогава ядат
 * чужд трафик.
 */

/**
 * Фирми, които при преглед се оказаха агенции или препродавачи. Без тях
 * автоматичният внос ги качваше отново при всяка нова партида.
 */
const IZKLYUCHENI_FIRMI = [
  "ДИМИТЪР КАЗАКОВ",
  "ДЯКОН ИЛАРИОН",
  "ЕР СТРОЙ РЕМОНТИ",
  "БЪЛГАРИЯ ПРОПЪРТИ КОНСУЛТИНГ",
  "РЕАЛИСТ",
  "REALIST",
  "ЕМ ДИ ЕСТЕЙТС",
  "ДОМ НА БЪДЕЩЕТО",
  "ИМОТИ СИ",
  "ПРОПЪРТИ ГРУП ИНВЕСТМЪНТС",
  "АРТ ДИЗАЙН КОНЦЕПТ",
  "К - КОНСУЛТ",
  "К-КОНСУЛТ",
  "ТАКТ ЕООД",
  "ЕУРОПИЯ",
  "21-22 ИНВЕСТ",
  "ТЕКТОНИКА ПЛЮС",
  "ПАЛЛАНТ ИНВЕСТ",
  "К ЕСТЕЙТС",
  "ВИП КОНСУЛТАС",
];

/**
 * Номерът на обявата от адреса ѝ.
 *
 * imot.bg сменя опашката на адреса, когато обявата се редактира:
 * същата обява на ГЕРТ ГРУП беше „…-grad-plovdiv-karshiyaka“, а после
 * „…-grad-plovdiv-ostromila-yuzhen“. Сравнение по целия адрес не я
 * познава и тя влиза в сайта втори път. Номерът не се мени.
 */
function obiavaId(url: string | null) {
  return url?.match(/obiava-([0-9a-z]+)-/i)?.[1] ?? url ?? "";
}

/**
 * Адресът, както да го прочете човек: улица и номер, когато ги има,
 * иначе кварталът, иначе само населеното място.
 *
 * Улицата идва от реда „Местоположение“ в обявата и я има горе-долу при
 * една на девет обяви — продавачът не е длъжен да я попълни.
 */
function sastaviAdres(data: {
  street: string | null;
  neighborhood: string | null;
  city: string | null;
  isVillage: boolean;
}) {
  const mqsto = data.neighborhood
    ? `кв. ${data.neighborhood}`
    : `${data.isVillage ? "с." : "гр."} ${data.city ?? ""}`.trim();
  return data.street ? `${data.street}, ${mqsto}` : mqsto;
}

export type ImportPreview = ImotListing & {
  stage: ReturnType<typeof guessStage>;
  /** Името на комплекса, ако imot.bg го е сложил в адреса на обявата. */
  projectName: string | null;
  alreadyImported: boolean;
};

/** „…-trakiya-trakiya-siti-park“ → „Тракия Сити Парк“ не се познава от адреса,
 *  но самите думи стигат, за да се потърси после в сайта на строителя. */
function projectFromUrl(url: string, neighborhood: string | null) {
  const slug = url.split("/").pop() ?? "";
  const parts = slug.replace(/^obiava-[^-]+-/, "").split("-");
  const cut = parts.indexOf("plovdiv");
  if (cut === -1) return null;
  const tail = parts.slice(cut + 1);
  // Първата дума след града е кварталът; каквото остане след него е
  // името на комплекса, ако изобщо има такова.
  const hood = neighborhood?.toLowerCase().split(" ")[0] ?? "";
  const rest = tail.filter((w) => w && !hood.startsWith(w.slice(0, 4)));
  return rest.length ? rest.join(" ") : null;
}

export async function previewImotListing(url: string): Promise<ImportPreview> {
  await requireAdmin();
  const supabase = await createClient();

  const data = await fetchImotListing(url.trim());

  const { data: known } = await supabase
    .from("listings")
    .select("source_url")
    .not("source_url", "is", null);
  const existing = (known ?? []).some(
    (row) => obiavaId(row.source_url) === obiavaId(data.sourceUrl),
  );

  return {
    ...data,
    stage: guessStage(data.constructionNote, data.description),
    projectName: projectFromUrl(data.sourceUrl, data.neighborhood),
    alreadyImported: existing,
  };
}

export type ImportInput = {
  sourceUrl: string;
  dealType?: "sale" | "rent";
  propertyType: PropertyType;
  developerName: string;
  developerPhone: string;
  permissionNote: string;
  projectName: string | null;
  stage: "planned" | "building" | "act14" | "act15" | "act16" | null;
  /** Обещаният срок при имот в строеж. */
  completionYear: number | null;
  /** Годината, в която сградата е построена — само за готов имот. */
  yearBuilt: number | null;
  title: string;
  description: string | null;
  address: string;
  cityId: string;
  neighborhoodId: string | null;
  price: number;
  areaSqm: number;
  rooms: number | null;
  floor: number | null;
  photos: string[];
  features?: ImotListing["features"];
};

export async function importImotListing(input: ImportInput) {
  const admin = await requireAdmin();
  const supabase = await createClient();

  // Без фирма се допуска само наем от собственик; телефонът е задължителен винаги.
  const bezFirma = !input.developerName.trim() && input.dealType === "rent";
  if (
    (!input.developerName.trim() && !bezFirma) ||
    !input.developerPhone.trim()
  ) {
    throw new Error("Фирмата и телефонът ѝ са задължителни.");
  }
  if (!input.permissionNote.trim()) {
    throw new Error(
      "Опиши откъде е разрешението на фирмата. Трябва да можеш да го докажеш.",
    );
  }

  // Фирмата се завежда веднъж; следващите ѝ обяви я намират по име.
  const { data: developer, error: developerError } = bezFirma
    ? { data: null, error: null }
    : await supabase
        .from("developers")
        .upsert(
          {
            name: input.developerName.trim(),
            phone: input.developerPhone.trim(),
            permission_at: new Date().toISOString(),
            permission_note: input.permissionNote.trim(),
          },
          { onConflict: "name" },
        )
        .select("id")
        .single();

  if (!bezFirma && (developerError || !developer)) {
    throw new Error(`Грешка при записа на фирмата: ${developerError?.message}`);
  }

  const listingId = crypto.randomUUID();

  // Снимките се теглят от imot.bg и се качват в нашето хранилище от името
  // на администратора — политиката иска първата папка да е неговият id.
  //
  // На групи, а не една по една: една обява носи към 17 снимки и всяка
  // иска сваляне и качване. Последователно това е половин минута на обява
  // и прави внасянето на цял град въпрос на часове. По шест наведнъж е
  // достатъчно бързо, без да залива imot.bg.
  const ZAEDNO = 6;
  // До 10 снимки на обява: безплатното хранилище е 1 GB, а строителите
  // качват по 17 почти еднакви рендера. Последната се пази — там обикновено
  // е планът на апартамента, който купувачът търси.
  const MAKS_SNIMKI = 10;
  const iztochnici =
    input.photos.length > MAKS_SNIMKI
      ? [
          ...input.photos.slice(0, MAKS_SNIMKI - 1),
          input.photos[input.photos.length - 1],
        ]
      : input.photos;
  const svaleni: (string | null)[] = new Array(iztochnici.length).fill(null);

  for (let start = 0; start < iztochnici.length; start += ZAEDNO) {
    const grupa = iztochnici.slice(start, start + ZAEDNO);
    await Promise.all(
      grupa.map(async (source, offset) => {
        const index = start + offset;
        try {
          const response = await fetch(source, {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Referer: "https://www.imot.bg/",
            },
          });
          if (!response.ok) return;

          const original = Buffer.from(await response.arrayBuffer());
          // imot.bg дава слабо компресирани файлове — средно 297 kB за
          // снимка, която при 1280 пиксела и качество 78 тежи 106 kB без
          // видима загуба. Разликата е между ~280 и ~780 обяви в същото
          // хранилище.
          let bytes: Buffer = original;
          try {
            bytes = await sharp(original)
              .rotate()
              .resize({ width: 1280, withoutEnlargement: true })
              .jpeg({ quality: 78, mozjpeg: true })
              .toBuffer();
          } catch {
            // Нечетима от sharp снимка влиза както си е — по-добре
            // голяма, отколкото никаква.
          }

          const path = `${admin.id}/${listingId}/${index}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from("listing-photos")
            .upload(path, bytes, {
              contentType:
                bytes === original
                  ? (response.headers.get("content-type") ?? "image/jpeg")
                  : "image/jpeg",
              upsert: true,
            });
          if (uploadError) return;

          svaleni[index] = supabase.storage
            .from("listing-photos")
            .getPublicUrl(path).data.publicUrl;
        } catch {
          // Една пропаднала снимка не бива да спира цялата обява.
        }
      }),
    );
  }

  // Редът на снимките е редът в обявата — затова се пази по индекс и
  // чак накрая се изчистват празните места.
  const photoUrls = svaleni.filter((url): url is string => url !== null);

  if (photoUrls.length === 0) {
    throw new Error("Нито една снимка не се свали. Обявата не е качена.");
  }

  const { error: listingError } = await supabase.from("listings").insert({
    id: listingId,
    user_id: admin.id,
    type: input.dealType ?? "sale",
    property_type: input.propertyType,
    city_id: input.cityId,
    neighborhood_id: input.neighborhoodId,
    price: input.price,
    area_sqm: input.areaSqm,
    rooms: input.rooms,
    floor: input.floor,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    address: input.address.trim(),
    // Телефонът е НА ФИРМАТА, не на профила, който я качва.
    phone: input.developerPhone.trim(),
    developer_id: developer?.id ?? null,
    project_name: input.projectName?.trim() || null,
    construction_stage: input.stage,
    completion_year: input.completionYear,
    year_built: input.yearBuilt,
    source_url: input.sourceUrl,
    source_checked_at: new Date().toISOString(),
    is_furnished: input.features?.furnished ?? false,
    has_elevator: input.features?.elevator ?? false,
    has_parking: input.features?.parking ?? false,
    has_terrace: input.features?.terrace ?? false,
  });

  if (listingError) {
    throw new Error(`Грешка при записа на обявата: ${listingError.message}`);
  }

  const { error: photosError } = await supabase
    .from("listing_photos")
    .insert(
      photoUrls.map((url, position) => ({
        listing_id: listingId,
        url,
        position,
      })),
    );
  if (photosError) {
    throw new Error(`Грешка при записа на снимките: ${photosError.message}`);
  }

  revalidatePath("/listings");
  revalidatePath("/admin/import");
  return { listingId, photos: photoUrls.length };
}

export type FoundListing = {
  url: string;
  alreadyImported: boolean;
};

/**
 * Казва кои от подадените обяви още ги няма при нас.
 *
 * Приема готов списък адреси, а не адрес на търсене: филтърът „Строителни
 * фирми“ живее в сесията на потребителя в imot.bg и сървърът не го вижда —
 * поискана оттук, същата страница връща и обявите на агенциите.
 */
export async function findImotListings(
  urls: string[],
): Promise<FoundListing[]> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("listings")
    .select("source_url")
    .not("source_url", "is", null);

  const known = new Set(
    (existing ?? []).map((row) => obiavaId(row.source_url)),
  );
  return urls.map((url) => ({
    url,
    alreadyImported: known.has(obiavaId(url)),
  }));
}

/**
 * Внася една обява без ръчно попълване: всичко се взима от самата обява.
 *
 * Използва се от партидното внасяне. Онова, което човек не може да провери
 * за 40 обяви наведнъж, тук се решава по правило: липсва ли цена или
 * квадратура, обявата се пропуска, вместо да влезе наполовина.
 */
export async function importImotAutomatically(
  url: string,
  permissionNote: string,
) {
  await requireAdmin();
  const supabase = await createClient();

  const data = await fetchImotListing(url);

  // Предпазителят: каквото и да е дошло в списъка, агенция не влиза.
  // Цялата платформа обещава „без посредници“ — една агенционна обява
  // струва повече доверие, отколкото десет обяви носят.
  // Под наем собственикът сам е „без посредник“ — затова при наемите
  // частното лице се пуска. При продажбите остават само строители.
  const sobstvenik = data.sellerKind === "private" && data.dealType === "rent";
  if (
    data.sellerKind === "agency" ||
    (data.sellerKind === "private" && !sobstvenik)
  ) {
    return {
      skipped:
        `не е строител (${data.sellerKind === "agency" ? "агенция" : "частно лице"})` as const,
    };
  }
  if (data.sellerKind === "unknown") {
    return { skipped: "не се разбра кой подава обявата" as const };
  }
  if (!data.propertyType) {
    return { skipped: "вид имот, който сайтът не описва" as const };
  }
  if (!data.priceEur || !data.areaSqm) {
    return { skipped: "няма цена или квадратура" as const };
  }
  if ((!data.company && !sobstvenik) || data.phones.length === 0) {
    return { skipped: "няма фирма или телефон" as const };
  }
  if (data.photos.length === 0) {
    return { skipped: "няма снимки" as const };
  }

  // Втора проверка за агенция, върху самия текст.
  //
  // Маркерът на imot.bg („Инвеститор“, „Строителна фирма“) казва за какъв
  // профил е платила фирмата, не каква е. Обява, която започва с
  // „Агенция Конто Бг ви предлага“, мина през него без да трепне.
  //
  // Нарочно НЕ се гледа думата „посредник“ сама по себе си: строителите
  // пишат „без посредници“ като предимство. „Посредническа услуга“ е
  // друго и се лови.
  //
  // Правилото е да се сбърка към отказ: по-добре да изпуснем честна
  // обява, отколкото да качим агенция. Цялата платформа обещава обратното.
  const tekst = `${data.company ?? ""} ${data.description ?? ""}`;
  // Собствениците под наем пишат „БЕЗ БРОКЕРИ И АГЕНЦИИ!“ и „Агенции,
  // моля, не се обаждайте“. Това е отказ от агенции, не агенция, затова
  // точно тези отрязъци се махат преди проверката. Само тях — „агенцията
  // ни не взема комисиона“ трябва да си остане хваната.
  const bezOtkazi = tekst
    .replace(
      /(без|моля|не\s+(?:желая|искам|приемам|търся|работ\S*))[^.!?\n]{0,40}?(агенц|брокер|посредни)\S*(\s*(,|и|или)\s*(агенц|брокер|посредни)\S*)*/gi,
      " ",
    )
    .replace(
      /(агенц|брокер|посредни)\S*[^.!?\n]{0,40}?(моля[,\s]+не|не\s+(?:се\s+)?(?:обаждайте|звънете|търся|желая|приемам|безпокойте))[^.!?\n]*/gi,
      " ",
    );
  if (/агенц|брокер|посредническ/i.test(bezOtkazi)) {
    return { skipped: "текстът на обявата звучи на агенция" as const };
  }
  // Каквото мина през горното и после се оказа агенция или препродажба:
  // „консултинг“ в името, „след тотален ремонт“ (стар имот), бранд на
  // кредитен посредник. „От собственик“ нарочно не е тук — пишат го и
  // строители за собствените си апартаменти (РИК БИЛДИНГ).
  // „За ремонт“ и стар Акт 16 значат препродажба, не ново строителство.
  // При наем старият, ремонтиран имот е нормален — там важи само
  // проверката за консултинг и кредитен посредник.
  const zaNaem = data.dealType === "rent";
  if (
    /консултинг|консултас|real\s+estate|риълти|realty|кантора|квартири|кредитн\S*\s+посредник/i.test(tekst) ||
    (!zaNaem &&
      (/тотален\s+ремонт|за\s+ремонт|след\s+(?:цялостен\s+)?ремонт|панелн\S*\s+(?:жилищн\S*\s+)?(?:сграда|блок)/i.test(
        tekst,
      ) ||
        /акт\s*16\)?\s*(?:от\s*)?(?:19|200|201)\d/i.test(tekst)))
  ) {
    return {
      skipped: "текстът на обявата звучи на агенция или препродажба" as const,
    };
  }
  // Общежития с легла не са жилище, а обява, която отказва роми или
  // чужденци, не се публикува изобщо.
  if (
    /общежитие|легла\s+за\s+работници|(^|[^а-я])роми([^а-я]|$)|цигани|ромск\S*\s+произход|чуждестранн\S*\s+граждан|без\s+[^.!\n]{0,30}чужденци|само\s+за\s+българск/i.test(
      tekst,
    )
  ) {
    return { skipped: "не е жилище или текстът дискриминира" as const };
  }
  // Фирми, махнати след преглед. Сравнява се без регистър и кавички.
  const firma = (data.company ?? "")
    .toUpperCase()
    .replace(/["„“'.]/g, "")
    .trim();
  if (IZKLYUCHENI_FIRMI.some((ime) => firma.includes(ime))) {
    return { skipped: "фирмата е изключена от платформата" as const };
  }

  // Без описание няма как да се провери кой подава обявата — а и няма
  // какво да се покаже на купувача.
  if (!data.description || data.description.trim().length < 80) {
    return { skipped: "няма описание" as const };
  }

  // Един и същи имот, качен няколко пъти с различни номера.
  //
  // РИК БИЛДИНГ държат един апартамент в три обяви — веднъж като
  // „Кършияка“, веднъж като „Център“ — със съвсем същия текст. В imot.bg
  // това вдига обявата нагоре; при нас би значело един апартамент на три
  // места. Номерът им е различен, затова проверката по адрес не помага.
  //
  // Сверяват се фирма, цена, квадратура И описание наведнъж: строител
  // спокойно може да продава два еднакви апартамента на различни етажи,
  // но тогава описанието казва кой етаж и коя секция.
  const { data: sashtiyat } = await supabase
    .from("listings")
    .select("id")
    .eq("price", data.priceEur)
    .eq("area_sqm", data.areaSqm)
    .eq("description", data.description ?? "")
    .limit(1)
    .maybeSingle();
  if (sashtiyat) {
    return { skipped: "същият имот вече е качен под друга обява" as const };
  }

  // Населеното място се чете от обявата, не се подава отвън: иначе целият
  // внос е заключен за един град, а обявите са в цяла България.
  if (!data.city) {
    return { skipped: "не се разбра кое е населеното място" as const };
  }
  const { data: grad } = await supabase
    .from("cities")
    .select("id")
    .ilike("name", data.city.trim())
    .eq("is_village", data.isVillage)
    .limit(1)
    .maybeSingle();
  if (!grad) {
    return {
      skipped: `населеното място „${data.city}“ го няма в списъка` as const,
    };
  }
  const cityId = grad.id;

  // Кварталът от обявата се сверява със списъка в базата; не се познае ли,
  // обявата пак влиза, само че без квартал — по-добре от грешен квартал.
  let neighborhoodId: string | null = null;
  if (data.neighborhood) {
    const { data: hood } = await supabase
      .from("neighborhoods")
      .select("id")
      .eq("city_id", cityId)
      .ilike("name", data.neighborhood.trim())
      .maybeSingle();
    neighborhoodId = hood?.id ?? null;
  }

  const result = await importImotListing({
    sourceUrl: data.sourceUrl,
    dealType: data.dealType,
    propertyType: data.propertyType,
    // Собственикът няма фирма — обявата влиза без строител, само с телефона.
    developerName: sobstvenik ? "" : (data.company ?? ""),
    // Всички телефони, не само първият: строителите дават по два-три
    // и ги пишат в края на описанието. Купувачът трябва да ги вижда в
    // „Контакти“, а не да ги търси в текста.
    developerPhone: data.phones.join(", "),
    permissionNote,
    projectName: null,
    stage: guessStage(data.constructionNote, data.description),
    // Една и съща година значи различно нещо според наклонението:
    // „въведен 2026 г.“ е факт, „ще бъде въведен 2027 г.“ е обещание.
    completionYear: data.commissioned ? null : data.commissionYear,
    yearBuilt: data.commissioned ? data.commissionYear : null,
    title: data.title?.split("::")[0]?.trim() || `Имот в ${data.city}`,
    description: data.description,
    address: sastaviAdres(data),
    cityId,
    neighborhoodId,
    price: data.priceEur,
    areaSqm: data.areaSqm,
    rooms: data.rooms,
    floor: data.floor,
    photos: data.photos,
    features: data.features,
  });

  return { imported: result, company: data.company };
}

/**
 * Препрочита описанията на вече качените фирмени обяви.
 *
 * Нужно е, защото четенето на описанието се поправя в движение: дълго
 * време кодовете на емотиконите (`&#127969;`) влизаха както са, а новите
 * редове се сливаха в един абзац. Записаното тогава не може да се оправи
 * на място — редовете вече ги няма — затова текстът се взима наново от
 * източника.
 *
 * Снимките не се пипат: те са си качени и тежат.
 */
export async function refreshDescriptions() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: redove } = await supabase
    .from("listings")
    .select("id, source_url")
    .not("developer_id", "is", null)
    .not("source_url", "is", null);

  let obnoveni = 0;
  const propadnali: string[] = [];

  for (const red of redove ?? []) {
    if (!red.source_url) continue;
    try {
      const data = await fetchImotListing(red.source_url);
      if (!data.description) {
        propadnali.push(`${obiavaId(red.source_url)} — няма описание`);
        continue;
      }
      const { error } = await supabase
        .from("listings")
        .update({
          description: data.description,
          // Всички телефони от обявата, не само първият.
          ...(data.phones.length ? { phone: data.phones.join(", ") } : {}),
          // Адресът се пипа САМО ако източникът дава улица.
          //
          // Част от адресите са търсени на ръка — името на комплекса води
          // до сайта на строителя и оттам до улицата („бул. България, зад
          // новата сграда на ПУ“). imot.bg за същата обява казва само
          // „кв. Кършияка“. Безусловното презаписване ги изтри веднъж;
          // по-доброто не бива да отстъпва на по-лошото.
          ...(data.street ? { address: sastaviAdres(data) } : {}),
        })
        .eq("id", red.id);
      if (error) {
        propadnali.push(`${obiavaId(red.source_url)} — ${error.message}`);
        continue;
      }
      obnoveni += 1;
    } catch (caught) {
      propadnali.push(
        `${obiavaId(red.source_url)} — ${
          caught instanceof Error ? caught.message : "грешка"
        }`,
      );
    }
  }

  revalidatePath("/listings");
  return { obnoveni, propadnali };
}
