import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CityMap, type CityMapNeighborhood } from "@/components/city-map";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cityId: string }>;
}): Promise<Metadata> {
  const { cityId } = await params;
  const supabase = await createClient();
  const { data: city } = await supabase
    .from("cities")
    .select("name")
    .eq("id", cityId)
    .maybeSingle();

  return { title: city ? `Квартали в ${city.name}` : "Карта на града" };
}

export default async function CityMapPage({
  params,
}: {
  params: Promise<{ cityId: string }>;
}) {
  const { cityId } = await params;
  const supabase = await createClient();

  const [{ data: city }, { data: neighborhoods }] = await Promise.all([
    supabase.from("cities").select("id, name").eq("id", cityId).maybeSingle(),
    supabase
      .from("neighborhoods")
      .select("id, city_id, name, lat, lng")
      .eq("city_id", cityId)
      .not("lat", "is", null)
      .not("lng", "is", null)
      .order("name"),
  ]);

  if (!city) {
    notFound();
  }

  if (!neighborhoods || neighborhoods.length === 0) {
    redirect(`/listings?city=${city.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Начало
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900">
        Изберете квартал в {city.name}
      </h1>

      <div className="mt-6">
        <CityMap
          city={city}
          neighborhoods={neighborhoods as CityMapNeighborhood[]}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {neighborhoods.map((n) => (
          <Link
            key={n.id}
            href={`/listings?city=${city.id}&neighborhood=${n.id}`}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
          >
            {n.name}
          </Link>
        ))}
      </div>

      <Link
        href={`/listings?city=${city.id}`}
        className="mt-6 inline-block text-sm font-medium text-slate-500 underline hover:text-slate-900"
      >
        Всички обяви в {city.name} (без избран квартал) →
      </Link>
    </div>
  );
}
