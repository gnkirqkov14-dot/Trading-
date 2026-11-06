import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";
import {
  DEAL_TYPE_LABELS,
  PROPERTY_TYPE_LABELS,
  STATUS_LABELS,
} from "@/lib/listing-labels";
import type {
  ListingDealType,
  ListingStatus,
  PropertyType,
} from "@/lib/types/database";

export type ObyavaEksport =
  Database["public"]["Functions"]["admin_eksport_obyavi"]["Returns"][number];

const STRANICA = 1000;

/**
 * Всички активни обяви за админа, на части по 1000: Supabase връща най-много
 * толкова редове на заявка.
 */
export async function vsichkiObyavi(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ObyavaEksport[]> {
  const out: ObyavaEksport[] = [];
  for (let ot = 0; ; ot += STRANICA) {
    const { data, error } = await supabase
      .rpc("admin_eksport_obyavi")
      .range(ot, ot + STRANICA - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < STRANICA) return out;
  }
}

export function linkKamObyava(id: string) {
  const sayt = process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotpoint.com";
  return `${sayt}/listings/${id}`;
}

export const etiket = {
  status: (s: string) => STATUS_LABELS[s as ListingStatus] ?? s,
  type: (t: string) => DEAL_TYPE_LABELS[t as ListingDealType] ?? t,
  property: (t: string) => PROPERTY_TYPE_LABELS[t as PropertyType] ?? t,
};

/** Заглавие без главни букви, препинателни знаци и излишни интервали. */
export function normalnoZaglavie(t: string) {
  return t
    .toLocaleLowerCase("bg")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export type Grupa = { prichina: string; obyavi: ObyavaEksport[] };

/**
 * Вероятни дубликати: еднакъв телефон, еднакво заглавие, или едно и също
 * място и вид имот с почти еднаква квадратура (±3%) и цена (±5%).
 * Една двойка може да излезе в повече от една група — причината е различна.
 */
export function grupiDublikati(obyavi: ObyavaEksport[]): Grupa[] {
  const grupi: Grupa[] = [];
  const poKluch = (
    kluch: (o: ObyavaEksport) => string | null,
    prichina: string,
    nayMnogo = Infinity,
  ) => {
    const m = new Map<string, ObyavaEksport[]>();
    for (const o of obyavi) {
      const k = kluch(o);
      if (!k) continue;
      m.set(k, [...(m.get(k) ?? []), o]);
    }
    for (const g of m.values())
      if (g.length > 1 && g.length <= nayMnogo)
        grupi.push({ prichina, obyavi: g });
  };

  poKluch((o) => {
    const z = normalnoZaglavie(o.title);
    return z.length >= 12 ? z : null;
  }, "Еднакво заглавие");

  // Едно място и вид: сравняваме само вътре в групата.
  const myasta = new Map<string, ObyavaEksport[]>();
  for (const o of obyavi) {
    const k = [o.type, o.property_type, o.grad, o.kvartal ?? ""].join("|");
    myasta.set(k, [...(myasta.get(k) ?? []), o]);
  }
  for (const g of myasta.values()) {
    const sortirani = [...g].sort((a, b) => a.area_sqm - b.area_sqm);
    const vzeti = new Set<string>();
    for (let i = 0; i < sortirani.length; i++) {
      const a = sortirani[i];
      if (vzeti.has(a.id)) continue;
      const blizki = [a];
      for (let j = i + 1; j < sortirani.length; j++) {
        const b = sortirani[j];
        if (b.area_sqm > a.area_sqm * 1.03) break;
        if (vzeti.has(b.id)) continue;
        if (Math.abs(b.price - a.price) <= a.price * 0.05) blizki.push(b);
      }
      if (blizki.length > 1) {
        blizki.forEach((o) => vzeti.add(o.id));
        grupi.push({
          prichina: "Едно място, близки кв.м и цена",
          obyavi: blizki,
        });
      }
    }
  }

  // Телефонът е последен. Номер с повече от 6 обяви е по-скоро знак за
  // агенция или за внос на един номер, не за дубликат — такива не се
  // показват тук.
  poKluch((o) => o.telefon, "Еднакъв телефон", 6);

  return grupi;
}
