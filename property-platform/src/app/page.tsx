import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  BulgariaMap,
  type MapCity,
  type MapNeighborhood,
} from "@/components/bulgaria-map";
import { ListingCard, type ListingCardData } from "@/components/listing-card";

export default async function Home() {
  const supabase = await createClient();
  const [{ data: cities }, { data: neighborhoods }, { data: recentListings }] =
    await Promise.all([
      supabase
        .from("cities")
        .select("id, name, region, lat, lng")
        .not("lat", "is", null)
        .not("lng", "is", null),
      supabase
        .from("neighborhoods")
        .select("id, city_id, name, lat, lng")
        .not("lat", "is", null)
        .not("lng", "is", null),
      supabase
        .from("listings")
        .select(
          "id, type, property_type, price, area_sqm, rooms, status, title, cities(name), neighborhoods(name), listing_photos(url, position)",
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6),
    ]);

  const mapCities = (cities ?? []) as MapCity[];
  const mapNeighborhoods = (neighborhoods ?? []) as MapNeighborhood[];
  const listings = (recentListings ?? []) as unknown as ListingCardData[];

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 py-20 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-600/20">
          Публикуването е винаги безплатно
        </span>

        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Имоти директно от собственик — без посредници
        </h1>
        <p className="max-w-xl text-lg text-slate-600">
          Публикувай или намери апартамент, къща или парцел без агентски
          комисионни. Свържи се директно със собственика.
        </p>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/register"
            className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white transition hover:bg-slate-700"
          >
            Публикувай обява
          </Link>
          <Link
            href="/listings"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Разгледай обяви
          </Link>
        </div>

        <div className="mt-10 w-full max-w-3xl">
          <BulgariaMap cities={mapCities} neighborhoods={mapNeighborhoods} />
        </div>
      </section>

      {listings.length > 0 && (
        <section className="border-t border-slate-200 bg-white py-16">
          <div className="mx-auto max-w-6xl px-4">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-slate-900">
                Последни обяви
              </h2>
              <Link
                href="/listings"
                className="text-sm font-medium text-slate-700 underline hover:text-slate-900"
              >
                Виж всички обяви →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
