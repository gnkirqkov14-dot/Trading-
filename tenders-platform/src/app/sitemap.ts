import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Последните 5000 поръчки — отделна страница за всяка, за Google и AI търсачките. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const recent = await getStore().recentTenderIds(5000).catch(() => []);
  return [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/grants`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/advisor`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/alerts`, changeFrequency: "monthly", priority: 0.6 },
    ...recent.map((t) => ({
      url: `${SITE_URL}/tenders/${t.id}`,
      lastModified: t.updated_at ?? undefined,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
