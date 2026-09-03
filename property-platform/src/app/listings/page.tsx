import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListingFilters } from "@/components/listing-filters";
import { ListingCard, type ListingCardData } from "@/components/listing-card";
import type { ListingDealType, PropertyType } from "@/lib/types/database";

export const metadata: Metadata = { title: "Обяви" };

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    type?: string;
    propertyType?: string;
    city?: string;
  }>;
}) {
  const { type, propertyType, city } = await searchParams;
  const supabase = await createClient();

  const [{ data: cities }, listingsQuery] = await Promise.all([
    supabase.from("cities").select("id, name").order("name"),
    (() => {
      let query = supabase
        .from("listings")
        .select(
          "id, type, property_type, price, area_sqm, rooms, status, title, cities(name), neighborhoods(name), listing_photos(url, position)",
        )
        .order("status", { ascending: true })
        .order("created_at", { ascending: false });

      if (type) query = query.eq("type", type as ListingDealType);
      if (propertyType)
        query = query.eq("property_type", propertyType as PropertyType);
      if (city) query = query.eq("city_id", city);

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
        <ListingFilters cities={cities ?? []} />
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
