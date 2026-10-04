import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // /api/agent е нарочно отворен: каталогът за AI агенти и каталозите
      // на x402 (Bazaar) трябва да го намират.
      allow: ["/", "/api/agent"],
      disallow: ["/api/cron", "/alerts/confirm", "/alerts/unsubscribe"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
