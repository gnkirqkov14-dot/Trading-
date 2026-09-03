import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BulgariaMap, type MapCity } from "@/components/bulgaria-map";

export default async function Home() {
  const supabase = await createClient();
  const { data: cities } = await supabase
    .from("cities")
    .select("id, name, region, lat, lng")
    .not("lat", "is", null)
    .not("lng", "is", null);

  const mapCities = (cities ?? []) as MapCity[];

  return (
    <div className="flex flex-1 flex-col bg-slate-50">
      <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 px-4 py-20 text-center">
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
            className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white hover:bg-slate-700"
          >
            Публикувай обява
          </Link>
          <Link
            href="/listings"
            className="rounded-lg border border-slate-300 px-5 py-3 font-medium text-slate-700 hover:bg-white"
          >
            Разгледай обяви
          </Link>
        </div>

        <div className="mt-10 w-full max-w-3xl">
          <BulgariaMap cities={mapCities} />
        </div>
      </section>
    </div>
  );
}
