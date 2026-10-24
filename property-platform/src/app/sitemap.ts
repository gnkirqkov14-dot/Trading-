import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { SEO_CITIES, seoCityIds } from "@/lib/seo-cities";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotpoint.com";

// Supabase връща най-много 1000 реда на заявка, без значение от `limit`.
// Без страниците отдолу обява №1001 нататък просто изчезва от sitemap-а.
const PAGE_SIZE = 1000;

type SitemapListing = { id: string; city_id: string | null; updated_at: string };

async function activeListings() {
  const supabase = await createClient();
  const rows: SitemapListing[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await supabase
      .from("listings")
      .select("id, city_id, updated_at")
      .eq("status", "active")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, cityIds] = await Promise.all([
    activeListings(),
    seoCityIds(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/listings`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Само градовете с поне една обява — празните са noindex.
  const citiesWithListings = new Set(listings.map((listing) => listing.city_id));
  const cityRoutes: MetadataRoute.Sitemap = SEO_CITIES.filter((city) => {
    const id = cityIds.get(city.name);
    return id ? citiesWithListings.has(id) : false;
  }).map((city) => ({
    url: `${siteUrl}/imoti/${city.slug}`,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const listingRoutes: MetadataRoute.Sitemap = listings.map((listing) => ({
    url: `${siteUrl}/listings/${listing.id}`,
    lastModified: listing.updated_at,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  return [...staticRoutes, ...cityRoutes, ...listingRoutes];
}
