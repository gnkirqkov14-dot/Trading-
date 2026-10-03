import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://imotpoint.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // /api/agent е нарочно отворен: това е каталогът и платените
      // адреси за AI агенти (x402); каталозите им (Bazaar) ги обхождат.
      allow: ["/", "/api/agent"],
      disallow: ["/dashboard", "/api", "/admin"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
