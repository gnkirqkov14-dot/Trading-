import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://property-platform-five.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const { data: listings } = await supabase
    .from("listings")
    .select("id, created_at")
    .eq("status", "active");

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/listings`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/pricing`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const listingRoutes: MetadataRoute.Sitemap = (listings ?? []).map(
    (listing) => ({
      url: `${siteUrl}/listings/${listing.id}`,
      lastModified: listing.created_at,
      changeFrequency: "daily",
      priority: 0.7,
    }),
  );

  return [...staticRoutes, ...listingRoutes];
}
