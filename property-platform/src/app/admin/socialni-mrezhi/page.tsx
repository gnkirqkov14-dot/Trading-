import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/dal";
import { createClient } from "@/lib/supabase/server";
import { DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/listing-labels";
import type { ListingDealType, PropertyType } from "@/lib/types/database";

export const metadata: Metadata = { title: "За социалните мрежи" };

type ObyavaZaMrezhi = {
  id: string;
  type: ListingDealType;
  property_type: PropertyType;
  price: number;
  area_sqm: number;
  title: string;
  socialni_mrezhi_na: string | null;
  cities: { name: string } | null;
  neighborhoods: { name: string } | null;
  listing_photos: { url: string; position: number }[];
};

/**
 * Активните обяви, чиито собственици са отметнали, че може да ги пускаме
 * безплатно във Facebook, Instagram и TikTok. Най-новото съгласие е отгоре.
 */
export default async function SocialniMrezhiPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      "id, type, property_type, price, area_sqm, title, socialni_mrezhi_na, cities(name), neighborhoods(name), listing_photos(url, position)",
    )
    .eq("socialni_mrezhi", true)
    .eq("status", "active")
    .order("socialni_mrezhi_na", { ascending: false })
    .limit(200);
  const obyavi = (data ?? []) as unknown as ObyavaZaMrezhi[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">За социалните мрежи</h1>
        <Link
          href="/admin"
          className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-900"
        >
          Обяви
        </Link>
      </div>
      <p className="mb-6 text-sm text-slate-600">
        Собствениците на тези обяви са съгласни обявата да се пуска безплатно в
        социалните мрежи на imotpoint. Телефона им не публикувай там, сложи
        линка към обявата.
      </p>

      {obyavi.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Още няма обяви със съгласие.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {obyavi.map((o) => {
            const korica = [...o.listing_photos].sort(
              (a, b) => a.position - b.position,
            )[0];
            const myasto = [o.neighborhoods?.name, o.cities?.name]
              .filter(Boolean)
              .join(", ");
            return (
              <li
                key={o.id}
                className="flex gap-4 rounded-xl border border-slate-200 bg-white p-3"
              >
                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                  {korica && (
                    <Image
                      src={korica.url}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/listings/${o.id}`}
                    className="line-clamp-2 font-medium text-slate-900 hover:underline"
                  >
                    {o.title}
                  </Link>
                  <p className="mt-1 text-sm text-slate-600">
                    {DEAL_TYPE_LABELS[o.type]} ·{" "}
                    {PROPERTY_TYPE_LABELS[o.property_type]} ·{" "}
                    {o.price.toLocaleString("bg-BG")} € · {o.area_sqm} кв.м
                    {myasto && ` · ${myasto}`}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {o.listing_photos.length} снимки
                    {o.socialni_mrezhi_na &&
                      ` · съгласие от ${new Date(o.socialni_mrezhi_na).toLocaleDateString("bg-BG")}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
