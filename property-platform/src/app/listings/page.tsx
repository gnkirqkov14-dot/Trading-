import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListingFilters } from "@/components/listing-filters";
import { ListingCard, type ListingCardData } from "@/components/listing-card";
import type {
  ConstructionStage,
  ListingDealType,
  PropertyType,
} from "@/lib/types/database";

export const metadata: Metadata = {
  title: "Обяви",
  description:
    "Разгледай обяви за апартаменти, къщи и парцели директно от собственици в цяла България — без агентски комисионни.",
  // Всички филтрирани варианти (?city=, ?type=...) сочат към една и
  // съща канонична страница, за да не се разпръсква SEO тежестта.
  alternates: { canonical: "/listings" },
};

type SearchParams = {
  type?: string;
  propertyType?: string;
  city?: string;
  neighborhood?: string;
  priceMin?: string;
  priceMax?: string;
  areaMin?: string;
  areaMax?: string;
  rooms?: string;
  floor?: string;
  stage?: string;
  builder?: string;
  newBuild?: string;
  parking?: string;
  elevator?: string;
  terrace?: string;
  furnished?: string;
  sort?: string;
};

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [
    { data: selectedSettlement },
    { data: neighborhoods },
    listingsQuery,
  ] = await Promise.all([
      params.city
        ? supabase
            .from("cities")
            .select("id, name, region, municipality, is_village")
            .eq("id", params.city)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      params.city
        ? supabase
            .from("neighborhoods")
            .select("id, city_id, name")
            .eq("city_id", params.city)
            .order("name")
        : Promise.resolve({ data: [] }),
      (() => {
        let query = supabase
          .from("listings")
          .select(
            "id, type, property_type, price, area_sqm, rooms, status, construction_stage, completion_year, title, cities(name), neighborhoods(name), listing_photos(url, position)",
          );

        if (params.type) query = query.eq("type", params.type as ListingDealType);
        if (params.propertyType)
          query = query.eq("property_type", params.propertyType as PropertyType);
        if (params.city) query = query.eq("city_id", params.city);
        if (params.neighborhood)
          query = query.eq("neighborhood_id", params.neighborhood);
        if (params.priceMin) query = query.gte("price", Number(params.priceMin));
        if (params.priceMax) query = query.lte("price", Number(params.priceMax));
        if (params.areaMin) query = query.gte("area_sqm", Number(params.areaMin));
        if (params.areaMax) query = query.lte("area_sqm", Number(params.areaMax));
        if (params.floor) query = query.eq("floor", Number(params.floor));
        // Сегментът „от строителя“ стъпва на фирмата зад обявата, не на
        // етапа: етап може да липсва, ако обявата не го казва, а тогава
        // филтърът по етап би скрил точно нея.
        // Само продажби: наемът от собственик също е „без посредник“, но
        // не е от инвеститор и няма място в този раздел.
        if (params.builder === "1") {
          query = query.not("developer_id", "is", null).eq("type", "sale");
        }
        // Ново строителство — имот, за който е известен етап на строежа.
        if (params.newBuild === "1") {
          query = query.not("construction_stage", "is", null);
        }
        if (params.stage) {
          query = query.eq(
            "construction_stage",
            params.stage as ConstructionStage,
          );
        }
        if (params.rooms) {
          if (params.rooms === "4+") {
            query = query.gte("rooms", 4);
          } else {
            query = query.eq("rooms", Number(params.rooms));
          }
        }
        if (params.parking === "1") query = query.eq("has_parking", true);
        if (params.elevator === "1") query = query.eq("has_elevator", true);
        if (params.terrace === "1") query = query.eq("has_terrace", true);
        if (params.furnished === "1") query = query.eq("is_furnished", true);

        if (params.sort === "price_asc") {
          query = query.order("price", { ascending: true });
        } else if (params.sort === "price_desc") {
          query = query.order("price", { ascending: false });
        } else {
          query = query
            .order("status", { ascending: true })
            .order("created_at", { ascending: false });
        }

        return query;
      })(),
    ]);

  const listings = (listingsQuery.data ?? []) as unknown as ListingCardData[];
  const onlyBuilders = params.builder === "1";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {onlyBuilders ? "От инвеститор" : "Обяви"}
          </h1>
          {onlyBuilders && (
            <p className="mt-1 text-sm text-slate-500">
              Директно от строителя или инвеститора — без комисиона и без
              посредник.
            </p>
          )}
        </div>
        <Link
          href="/dashboard/listings/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Публикувай обява
        </Link>
      </div>

      <div className="mb-8">
        <ListingFilters
          selectedSettlement={selectedSettlement}
          neighborhoods={neighborhoods ?? []}
        />
      </div>

      {listings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-slate-500">
          Няма намерени обяви.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
