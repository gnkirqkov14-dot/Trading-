import { createClient } from "@/lib/supabase/server";
import type { ListingCardData } from "@/components/listing-card";

/**
 * Градските страници `/imoti/<slug>` — това, което хората пишат в Google
 * („имоти Пловдив“, „апартаменти София без посредник“).
 *
 * `/listings?city=...` не става за целта: всички филтрирани варианти са
 * с canonical към `/listings`, така че Google вижда само една страница
 * за цяла България. Тук всеки град има собствен адрес на латиница,
 * собствено заглавие и текст, сметнат от реалните обяви.
 *
 * Градът се търси по име сред градовете (не селата) — има села със
 * същите имена, виж бележката за повтарящите се имена в CLAUDE.md.
 */
export const SEO_CITIES = [
  { slug: "sofia", name: "София" },
  { slug: "plovdiv", name: "Пловдив" },
  { slug: "varna", name: "Варна" },
  { slug: "burgas", name: "Бургас" },
  { slug: "ruse", name: "Русе" },
  { slug: "stara-zagora", name: "Стара Загора" },
] as const;

export type SeoCity = (typeof SEO_CITIES)[number];

export function seoCityBySlug(slug: string): SeoCity | undefined {
  return SEO_CITIES.find((city) => city.slug === slug);
}

export type CityListing = ListingCardData & {
  neighborhoods: { id: string; name: string } | null;
};

/** id-тата на градовете от SEO_CITIES в базата, по име. */
export async function seoCityIds() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, name")
    .eq("is_village", false)
    .in(
      "name",
      SEO_CITIES.map((city) => city.name),
    );
  const ids = new Map<string, string>();
  for (const row of data ?? []) {
    if (!ids.has(row.name)) ids.set(row.name, row.id);
  }
  return ids;
}

export const NA_STRANICA_GRAD = 24;
const OTKAS_SVODKA = 1000;

export type CitySvodkaRed = {
  type: CityListing["type"];
  price: number;
  area_sqm: number;
  neighborhoods: { id: string; name: string } | null;
};

/** Активните обяви в един град: една страница карти и леки редове за сводката. */
export async function getCityListings(cityName: string, stranica = 1) {
  const supabase = await createClient();
  const { data: city } = await supabase
    .from("cities")
    .select("id, name")
    .eq("is_village", false)
    .eq("name", cityName)
    .limit(1)
    .maybeSingle();

  if (!city) {
    return {
      cityId: null,
      listings: [] as CityListing[],
      svodka: [] as CitySvodkaRed[],
    };
  }

  const ot = (stranica - 1) * NA_STRANICA_GRAD;
  const { data } = await supabase
    .from("listings")
    .select(
      "id, type, property_type, price, area_sqm, rooms, status, construction_stage, completion_year, title, cities(name), neighborhoods(id, name), listing_photos(url, position)",
    )
    .eq("status", "active")
    .eq("city_id", city.id)
    .order("created_at", { ascending: false })
    .range(ot, ot + NA_STRANICA_GRAD - 1);

  // Цените и кварталите са за целия град, не за една страница.
  const svodka: CitySvodkaRed[] = [];
  for (let from = 0; ; from += OTKAS_SVODKA) {
    const { data: redove } = await supabase
      .from("listings")
      .select("type, price, area_sqm, neighborhoods(id, name)")
      .eq("status", "active")
      .eq("city_id", city.id)
      .order("id")
      .range(from, from + OTKAS_SVODKA - 1);
    svodka.push(...((redove ?? []) as unknown as CitySvodkaRed[]));
    if ((redove ?? []).length < OTKAS_SVODKA) break;
  }

  return {
    cityId: city.id,
    listings: (data ?? []) as unknown as CityListing[],
    svodka,
  };
}
