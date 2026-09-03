import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListingFilters } from "@/components/listing-filters";
import { ListingCard, type ListingCardData } from "@/components/listing-card";
import type { ListingDealType, PropertyType } from "@/lib/types/database";

export const metadata: Metadata = { title: "Обяви" };

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

  const [{ data: cities }, { data: neighborhoods }, listingsQuery] =
    await Promise.all([
      supabase.from("cities").select("id, name").order("name"),
      supabase
        .from("neighborhoods")
        .select("id, city_id, name")
        .order("name"),
      (() => {
        let query = supabase
          .from("listings")
          .select(
            "id, type, property_type, price, area_sqm, rooms, status, title, cities(name), neighborhoods(name), listing_photos(url, position)",
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Обяви</h1>
        <Link
          href="/dashboard/listings/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Публикувай обява
        </Link>
      </div>

      <div className="mb-8">
        <ListingFilters cities={cities ?? []} neighborhoods={neighborhoods ?? []} />
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
