import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListingCard, type ListingCardData } from "@/components/listing-card";
import { HeroSearch, type PopularCity } from "@/components/home/hero-search";
import { HeroDeck } from "@/components/home/hero-deck";
import { HeroMark3D } from "@/components/home/hero-mark-3d";
import { PhoneHero } from "@/components/home/phone-hero";
import { GoalTiles } from "@/components/home/goal-tiles";
import { StoryScroll } from "@/components/home/story-scroll";
import { STORY_FRAMES } from "@/components/home/story-frames";
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

// Пали/гаси кадрите от скрол сцената (`components/home/story-scroll.tsx`)
// и снимката в началото на телефон. При false остава само градиент, а
// на широк екран се връща досегашният hero — това е аварийният изход с
// един ред, ако нещо със снимките се счупи.
const STORY_FRAMES_READY = true;

// Под този брой активни обяви към решетката се добавя покана „Тук ще е
// твоята обява" — една истинска обява до поканата изглежда честно,
// докато три празни кутийки изглеждат зле.
const MIN_LISTINGS_FOR_FEED = 3;

export default async function Home() {
  const supabase = await createClient();
  const [{ data: popularRows }, { data: recentListings }] = await Promise.all([
    supabase
      .from("cities")
      .select("id, name")
      .eq("is_village", false)
      .in("name", POPULAR_CITY_NAMES),
    supabase
      .from("listings")
      .select(
        "id, type, property_type, price, area_sqm, rooms, status, title, cities(name), neighborhoods(name), listing_photos(url, position)",
      )
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6),
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

      {/* Телефон: един екран, търсачката е най-важното и не се движи.
          Виж бележката в `phone-hero.tsx` защо не е същото като сцената. */}
      <PhoneHero
        popular={popular}
        photo={STORY_FRAMES_READY ? STORY_FRAMES[4] : null}
      />

      {/* Широк екран: сцената „едно място през времето". */}
      {STORY_FRAMES_READY ? (
        <StoryScroll popular={popular} />
      ) : (
      <section className="relative hidden overflow-hidden pb-24 pt-10 sm:pb-[8.75rem] sm:pt-[4.75rem] lg:block">
        {/* Меки цветни петна + точкова мрежа, избледняваща към ръбовете. */}
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(880px_600px_at_80%_4%,rgba(43,185,140,0.2),transparent_62%),radial-gradient(760px_620px_at_6%_96%,rgba(26,81,128,0.16),transparent_64%),linear-gradient(168deg,#ffffff_0%,#f2f7fa_55%,#eaf1f6_100%)]"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(#c9d9e6_1.1px,transparent_1.1px)] [background-size:27px_27px] [mask-image:radial-gradient(72%_62%_at_46%_42%,#000,transparent_76%)]"
        />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-[1.06fr_0.94fr] lg:gap-12">
          <div>
            <span className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white/85 py-1.5 pl-1.5 pr-4 text-[0.8rem] font-bold text-[#41607c] shadow-[0_6px_18px_-10px_rgba(15,36,56,0.35)] backdrop-blur">
              <b className="rounded-full bg-gradient-to-br from-accent-400 to-accent-500 px-2.5 py-1 text-[0.75rem] text-[#04231a]">
                0 €
              </b>
              комисионна · 5267 населени места
            </span>

            <h2 className="mt-6 font-display text-[2.6rem] font-semibold leading-[1.05] text-slate-900 sm:text-[4.375rem]">
              Имоти директно
              <br />
              от <em className="not-italic font-display italic text-accent-600">собственика</em>
            </h2>

            <p className="mt-6 max-w-md text-[1.05rem] font-medium leading-relaxed text-slate-500 sm:text-[1.15rem]">
              Без агенции по средата, без комисионна при сделка. Обявата е на
              собственика — и телефонът също.
            </p>

            <div className="mt-8 max-w-xl">
              <HeroSearch popular={popular} />
            </div>
          </div>

          <HeroDeck listings={listings} />
        </div>

        {/* На телефон стои в потока под картата; от lg нагоре излиза от
            потока и плава долу вдясно. Затова е след решетката в DOM-а —
            при absolute позицията не зависи от реда. */}
        <HeroMark3D className="pointer-events-none relative z-10 mx-auto mt-1 h-56 w-full max-w-[19rem] lg:absolute lg:bottom-6 lg:right-[2%] lg:mt-0 lg:h-[21rem] lg:w-[21rem] lg:max-w-none xl:bottom-8 xl:right-[6%] xl:h-[24rem] xl:w-[24rem]" />
      </section>
      )}

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
