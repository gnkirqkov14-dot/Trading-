import type { ListingDealType, PropertyType } from "@/lib/types/database";
import { cleanListingDescription } from "@/lib/listing-description";

export type BulkDraft = {
  folder: string;
  sourceId: string | null;
  city: string;
  neighborhood: string;
  type: ListingDealType;
  propertyType: PropertyType;
  price: number;
  area: number;
  rooms: number | null;
  floor: number | null;
  phone: string;
  title: string;
  description: string;
  address: string;
  /** true = Да, false = Не, null = Не е посочено. */
  furnished: boolean | null;
  elevator: boolean | null;
  parking: boolean | null;
  terrace: boolean | null;
  heating: string | null;
  /** Откъде е взета всяка стойност — показва се в прегледа преди внос. */
  izvor?: Partial<Record<Udobstvo | "heating", "pole" | "tekst">>;
};

export type Udobstvo = "parking" | "elevator" | "terrace" | "furnished";

/** Полетата в Описание.txt, с които се посочват удобствата изрично. */
export const POLETA_UDOBSTVA: Record<Udobstvo, string> = {
  parking: "Паркомясто",
  elevator: "Асансьор",
  terrace: "Тераса",
  furnished: "Обзавеждане",
};

export type BulkPreview = {
  folder: string;
  state: "ready" | "resume" | "duplicate" | "error";
  message: string;
  listingId?: string;
};

export function normalizePlace(value: string) {
  return value.toLocaleLowerCase("bg").replace(/[\s–—-]+/g, " ").trim();
}

export function sourceIdFromUrl(value: string | null) {
  return value?.match(/obiava-([a-z0-9]+)(?:-|$)/i)?.[1] ?? null;
}

export function validateBulkDraft(d: BulkDraft) {
  if (!d || typeof d !== "object") throw new Error("Невалидна обява.");
  for (const key of ["folder", "city", "phone", "title", "description", "address"] as const) {
    if (typeof d[key] !== "string" || !d[key].trim()) throw new Error(`Липсва ${key}.`);
  }
  if (d.description.length > 12_000 || d.title.length > 250 || d.folder.length > 250 || d.address.length > 600 || d.city.length > 120 || typeof d.neighborhood !== "string" || d.neighborhood.length > 160) {
    throw new Error("Текстът на обявата е прекалено дълъг.");
  }
  if (!["rent", "sale"].includes(d.type) || !["apartment", "house", "plot", "office", "shop"].includes(d.propertyType)) throw new Error("Неподдържан вид имот или сделка.");
  if (!Number.isFinite(d.price) || d.price <= 0 || d.price > 1_000_000_000) throw new Error("Нужна е валидна цена в евро.");
  if (!Number.isFinite(d.area) || d.area <= 0 || d.area > 100_000_000) throw new Error("Нужна е валидна квадратура.");
  if (!/^0\d{9}$|^\+[1-9]\d{7,14}$/.test(d.phone)) throw new Error("Невалиден телефон.");
  if (d.sourceId !== null && (typeof d.sourceId !== "string" || !/^[a-z0-9]{8,40}$/i.test(d.sourceId))) throw new Error("Невалиден номер на източника.");
  for (const key of ["rooms", "floor"] as const) {
    if (d[key] !== null && (!Number.isInteger(d[key]) || Math.abs(d[key]!) > 1000 || (key === "rooms" && d[key]! < 1))) throw new Error("Невалиден брой стаи или етаж.");
  }
  for (const key of ["furnished", "elevator", "parking", "terrace"] as const) {
    if (d[key] !== null && typeof d[key] !== "boolean") throw new Error("Невалидни удобства.");
  }
  if (d.heating !== null && (typeof d.heating !== "string" || d.heating.length > 120)) throw new Error("Невалидно отопление.");
}

export function parseBulkDescription(folder: string, input: string): BulkDraft {
  const text = input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  const field = (name: string) => text.match(new RegExp(`^${name}:[ \\t]*([^\\n]*)$`, "mi"))?.[1].trim() ?? "";
  const kind = field("Вид имот").toUpperCase();
  const propertyType: PropertyType | undefined = /^(?:[1-9]-СТАЕН|МНОГОСТАЕН|МЕЗОНЕТ)$/.test(kind)
    ? "apartment" : ({ "КЪЩА": "house", "ПАРЦЕЛ": "plot", "ОФИС": "office", "МАГАЗИН": "shop" } as Record<string, PropertyType>)[kind];
  if (!propertyType) throw new Error(`Неподдържан вид имот: ${kind || "липсва"}.`);
  const priceText = field("Цена");
  const amount = priceText.match(/([\d\s\u00a0]+(?:[.,]\d+)?)\s*(?:€|EUR|евро)/i)?.[1];
  if (!amount) throw new Error("Липсва числова цена в евро.");
  const rent = /на месец|под наем|отдава|дава.*наем/i.test(priceText + " " + text);
  if (!rent && !/продава|продажба/i.test(text)) throw new Error("Не е посочено дали имотът е за продажба или под наем.");
  const area = field("Площ").match(/\d+(?:[.,]\d+)?/)?.[0];
  const floorText = field("Етаж");
  const floor = /партер/i.test(floorText) ? 0 : floorText.match(/^-?\d+/)?.[0];
  const body = text.split(/^Вид имот:/mi)[0].replace(/^Описание на имота:\s*/i, "").trim();
  // Полетата за удобства и отопление се четат само от частта с данните
  // (от „Вид имот:“ надолу), за да не се объркат с ред от текста на обявата.
  const danni = text.slice(text.search(/^Вид имот:/mi));
  const poleOtDanni = (name: string) => danni.match(new RegExp(`^${name}:[ \\t]*([^\\n]*)$`, "mi"))?.[1].trim() ?? "";
  const description = cleanListingDescription(body + (/Цената е без ДДС/i.test(text) && !/Цената е без ДДС/i.test(body) ? "\n\nЦената е без ДДС." : ""));
  const city = field("Град");
  const neighborhood = field("Квартал");
  const deal = rent ? "под наем" : "за продажба";
  const phoneRaw = field("Телефон").replace(/[\s()/-]/g, "").replace(/^00359/, "+359");
  const phone = /^\+359\d{9}$/.test(phoneRaw) ? "0" + phoneRaw.slice(4) : phoneRaw;
  const draft: BulkDraft = {
    folder, sourceId: folder.match(/(?:^|_)([12][a-z]\d{10,20})(?:$|_)/i)?.[1] ?? null,
    city, neighborhood, type: rent ? "rent" : "sale", propertyType,
    price: Number(amount.replace(/[\s\u00a0]/g, "").replace(",", ".")), area: Number(area?.replace(",", ".")),
    rooms: kind.match(/^(\d+)-СТАЕН$/)?.[1] ? Number(kind[0]) : null,
    floor: floor === undefined ? null : Number(floor), phone,
    title: `${kind.charAt(0) + kind.slice(1).toLowerCase()} ${deal} в ${city}${neighborhood ? `, ${neighborhood}` : ""} — ${area ?? "?"} кв.м`,
    description, address: field("Адрес") || [neighborhood ? `кв. ${neighborhood}` : "", city].filter(Boolean).join(", "),
    furnished: null, elevator: null, parking: null, terrace: null, heating: null, izvor: {},
  };
  // Първо изрично попълненото поле; без него — само ясно казаното в текста.
  // Каквото не е посочено, остава „Не е посочено“, не „Не“.
  for (const key of Object.keys(POLETA_UDOBSTVA) as Udobstvo[]) {
    const pole = poleOtDanni(POLETA_UDOBSTVA[key]);
    if (pole) {
      const v = daNe(pole);
      if (v === undefined) throw new Error(`${POLETA_UDOBSTVA[key]}: „${pole}“ — напиши Да, Не или Не е посочено.`);
      draft[key] = v;
      if (v !== null) draft.izvor![key] = "pole";
    } else {
      const v = OT_TEKSTA[key](body);
      draft[key] = v;
      if (v !== null) draft.izvor![key] = "tekst";
    }
  }
  // Отоплението се записва дословно, само от полето. Климатик в текста не
  // значи, че с него се отоплява.
  const otoplenie = poleOtDanni("Отопление");
  if (otoplenie && !/^не е посочено$|^-+$|^—$/i.test(otoplenie)) {
    draft.heating = otoplenie.slice(0, 120);
    draft.izvor!.heating = "pole";
  }
  validateBulkDraft(draft);
  return draft;
}

/** Да / Не / Не е посочено от поле; undefined, ако стойността е неясна. */
function daNe(value: string): boolean | null | undefined {
  const v = value.toLocaleLowerCase("bg").replace(/[.\s]+$/, "").trim();
  if (/^(?:не е посочено|непосочено|няма информация|-+|—|\?)$/.test(v)) return null;
  if (/^(?:да|има|обзаведен[аио]?|частично обзаведен[аио]?)$/.test(v)) return true;
  if (/^(?:не|няма|необзаведен[аио]?)$/.test(v)) return false;
  return undefined;
}

/** Само изрично казаното в текста; иначе null („Не е посочено“). */
const OT_TEKSTA: Record<Udobstvo, (t: string) => boolean | null> = {
  furnished: t => /необзаведен|без обзавеждане/i.test(t) ? false : /обзаведен/i.test(t) ? true : null,
  elevator: t => /без асансьор|няма асансьор/i.test(t) ? false : /асансьор/i.test(t) ? true : null,
  parking: t => /без паркомясто|няма паркомясто/i.test(t) ? false : /с паркомясто|със? (?:собствен[оа]? |едно |две )?паркоме?ст/i.test(t) ? true : null,
  terrace: t => /без тераса|няма тераса/i.test(t) ? false : /терас[аи]/i.test(t) ? true : null,
};

/** Same data produce the same identity even when imported from another ZIP. */
export function bulkIdentity(d: BulkDraft) {
  return d.sourceId ? `imot:${d.sourceId}` : [normalizePlace(d.city), normalizePlace(d.neighborhood), d.type, d.propertyType, d.phone, d.price, d.area].join("|");
}
