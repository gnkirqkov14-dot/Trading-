import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ListingCard } from "@/components/listing-card";
import { formatPrice } from "@/lib/listing-labels";
import {
  NA_STRANICA_GRAD,
  SEO_CITIES,
  getCityListings,
  seoCityBySlug,
  type CitySvodkaRed,
} from "@/lib/seo-cities";

// generateMetadata и самата страница искат едни и същи обяви — `cache`
// ги тегли веднъж на заявка.
const loadCity = cache(async (slug: string, stranica: number) => {
  const city = seoCityBySlug(slug);
  if (!city) return null;
  const { cityId, listings, svodka } = await getCityListings(
    city.name,
    stranica,
  );
  return { city, cityId, listings, svodka };
});

function nomerStranica(page: string | undefined) {
  return Math.max(1, Math.floor(Number(page)) || 1);
}

function summarize(listings: CitySvodkaRed[]) {
  const sales = listings.filter(
    (listing) => listing.type === "sale" && listing.area_sqm > 0,
  );
  const prices = sales.map((listing) => listing.price);
  const perSqm = sales.map((listing) => listing.price / listing.area_sqm);

  const hoods = new Map<string, { id: string; name: string; count: number }>();
  for (const listing of listings) {
    const hood = listing.neighborhoods;
    if (!hood) continue;
    const entry = hoods.get(hood.id) ?? { ...hood, count: 0 };
    entry.count += 1;
    hoods.set(hood.id, entry);
  }

  return {
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    avgPerSqm: perSqm.length
      ? Math.round(perSqm.reduce((sum, value) => sum + value, 0) / perSqm.length)
      : null,
    neighborhoods: [...hoods.values()].sort((a, b) => b.count - a.count),
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { city: slug } = await params;
  const stranica = nomerStranica((await searchParams).page);
  const data = await loadCity(slug, stranica);
  if (!data) return { title: "Обяви" };

  const { city, svodka } = data;
  const title =
    stranica > 1
      ? `Имоти в ${city.name} без посредници, страница ${stranica}`
      : `Имоти в ${city.name} без посредници`;
  const description = svodka.length
    ? `${svodka.length} обяви за апартаменти и къщи в ${city.name} директно от собственик и строител — без агенция и без комисиона.`
    : `Обяви за имоти в ${city.name} директно от собственик — без агенция и без комисиона.`;

  return {
    title,
    description,
    alternates: {
      canonical:
        stranica > 1
          ? `/imoti/${city.slug}?page=${stranica}`
          : `/imoti/${city.slug}`,
    },
    openGraph: { title, description },
    // Празна градска страница е „тънко“ съдържание за Google — пускаме
    // я в индекса чак когато има поне една обява.
    ...(svodka.length ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function CityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { city: slug } = await params;
  const stranica = nomerStranica((await searchParams).page);
  const data = await loadCity(slug, stranica);
  if (!data) notFound();

  const { city, cityId, listings, svodka } = data;
  const obshto = svodka.length;
  const stranici = Math.max(1, Math.ceil(obshto / NA_STRANICA_GRAD));
  if (stranica > stranici) notFound();

  const { minPrice, maxPrice, avgPerSqm, neighborhoods } = summarize(svodka);
  const kamStranica = (n: number) =>
    n > 1 ? `/imoti/${city.slug}?page=${n}` : `/imoti/${city.slug}`;
  const otherCities = SEO_CITIES.filter((other) => other.slug !== city.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">
        Имоти в {city.name} без посредници
      </h1>

      {obshto > 0 ? (
        <p className="mt-3 max-w-3xl text-slate-600">
          {obshto}{" "}
          {obshto === 1 ? "обява" : "обяви"} за имоти в {city.name},
          публикувани директно от собственици и строители — без агенция и
          без комисиона.
          {minPrice !== null && maxPrice !== null && (
            <>
              {" "}
              Цените са от {formatPrice(minPrice)} до {formatPrice(maxPrice)}
              {avgPerSqm !== null && (
                <>, средно {formatPrice(avgPerSqm)} на кв.м</>
              )}
              .
            </>
          )}
        </p>
      ) : (
        <p className="mt-3 max-w-3xl text-slate-600">
          Още няма обяви в {city.name}. Публикуването е безплатно — сложи
          първата.
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {cityId && obshto > 0 && (
          <Link
            href={`/listings?city=${cityId}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Филтрирай по цена, стаи, квартал
          </Link>
        )}
        <Link
          href="/dashboard/listings/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Публикувай обява безплатно
        </Link>
      </div>

      {neighborhoods.length > 0 && cityId && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-slate-900">
            Квартали в {city.name}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {neighborhoods.map((hood) => (
              <li key={hood.id}>
                <Link
                  href={`/listings?city=${cityId}&neighborhood=${hood.id}`}
                  className="inline-block rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:border-slate-400"
                >
                  {hood.name}{" "}
                  <span className="text-slate-400">({hood.count})</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {listings.length > 0 && (
        <section className="mt-10">
          <h2 className="sr-only">Обяви в {city.name}</h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {stranici > 1 && (
            <nav
              aria-label="Страници"
              className="mt-8 flex items-center justify-center gap-3 text-sm"
            >
              {stranica > 1 && (
                <Link
                  href={kamStranica(stranica - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-100"
                >
                  ← Назад
                </Link>
              )}
              <span className="text-slate-500">
                Страница {stranica} от {stranici}
              </span>
              {stranica < stranici && (
                <Link
                  href={kamStranica(stranica + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-2 hover:bg-slate-100"
                >
                  Напред →
                </Link>
              )}
            </nav>
          )}
        </section>
      )}

      <nav className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        Имоти в други градове:{" "}
        {otherCities.map((other, index) => (
          <span key={other.slug}>
            {index > 0 && " · "}
            <Link
              href={`/imoti/${other.slug}`}
              className="text-slate-700 underline-offset-4 hover:underline"
            >
              {other.name}
            </Link>
          </span>
        ))}
      </nav>
    </div>
  );
}
