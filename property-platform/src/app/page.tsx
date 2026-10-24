import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListingCard, type ListingCardData } from "@/components/listing-card";
import { type PopularCity } from "@/components/home/hero-search";
import { HeroBanner } from "@/components/home/hero-banner";
import { GoalTiles } from "@/components/home/goal-tiles";
import {
  CostComparison,
  HomeCta,
  HowItWorks,
  StatBand,
  Wave,
} from "@/components/home/sections";

// Чиповете "Популярни" под търсачката. Търсят се по име сред градовете
// (не селата) — има и села със същите имена, виж бележката за 527-те
// повтарящи се имена в CLAUDE.md.
const POPULAR_CITY_NAMES = ["София", "Пловдив", "Варна", "Бургас"];

// Под този брой активни обяви към решетката се добавя покана „Тук ще е
// твоята обява" — една истинска обява до поканата изглежда честно,
// докато три празни кутийки изглеждат зле.
const MIN_LISTINGS_FOR_FEED = 3;

export default async function Home() {
  const supabase = await createClient();
  const [
    { data: popularRows },
    { data: recentListings },
    { count: broiObqvi },
  ] = await Promise.all([
    supabase
      .from("cities")
      .select("id, name")
      .eq("is_village", false)
      .in("name", POPULAR_CITY_NAMES),
    supabase
      .from("listings")
      .select(
        "id, type, property_type, price, area_sqm, rooms, status, construction_stage, completion_year, title, cities(name), neighborhoods(name), listing_photos(url, position)",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6),
    // Живото число в банера — само брой, без самите редове.
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const byName = new Map((popularRows ?? []).map((row) => [row.name, row]));
  const popular = POPULAR_CITY_NAMES.map((name) => byName.get(name)).filter(
    Boolean,
  ) as PopularCity[];

  const listings = (recentListings ?? []) as unknown as ListingCardData[];
  const showInvite = listings.length < MIN_LISTINGS_FOR_FEED;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotpoint.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", name: "Имоти без посредници", url: siteUrl },
      { "@type": "WebSite", name: "Имоти без посредници", url: siteUrl },
    ],
  };

  return (
    <div className="flex flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Една снимка, обещанието на сайта и бутон към обявите — на
          всички екрани еднакво. Виж `components/home/hero-banner.tsx`. */}
      <HeroBanner popular={popular} broiObqvi={broiObqvi ?? 0} />

      {/* Трите причини, заради които човек изобщо е тук. */}
      <GoalTiles />

      {/* Обявите са доказателството, че сайтът е жив — затова стоят
          високо, а не под цялата разказвателна част. */}
      <section className="bg-white py-10 sm:py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.17em] text-brand-600">
                Наскоро
              </p>
              <h2 className="mt-2 font-display text-[1.45rem] font-semibold leading-tight text-slate-900 sm:text-3xl">
                Последни обяви
              </h2>
            </div>
            {listings.length > 0 && (
              <Link
                href="/listings"
                className="text-sm font-semibold text-slate-600 underline underline-offset-4 hover:text-slate-900"
              >
                Виж всички обяви →
              </Link>
            )}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}

            {showInvite && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-[1.5px] border-dashed border-slate-300 bg-white px-5 py-9 text-center">
                <p className="font-display text-[1.05rem] font-semibold text-slate-900">
                  Тук ще е твоята обява
                </p>
                <p className="mt-1.5 text-[0.86rem] leading-relaxed text-slate-500">
                  Сайтът е нов. Първите обяви се виждат от всички посетители.
                </p>
                <Link
                  href="/dashboard/listings/new"
                  className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-700"
                >
                  Публикувай безплатно
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      <Wave fill="#17344d" />
      <StatBand />
      <Wave fill="#faf7f1" />
      <HowItWorks />
      <Wave fill="#faf7f1" flip />
      <CostComparison />

      <HomeCta />
    </div>
  );
}
