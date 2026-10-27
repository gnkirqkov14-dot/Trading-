import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Програми, които масово теглят обяви. Google, Bing, AI търсачките и
// SEO ботовете не са тук — те водят хора към сайта.
const KOPIRACHI =
  /python-requests|python-urllib|aiohttp|httpx|scrapy|curl\/|wget|go-http-client|okhttp|java\/|apache-httpclient|libwww-perl|node-fetch|axios|undici|got \(|php\/|guzzle|headlesschrome|phantomjs|puppeteer|playwright|selenium|colly|httrack|webcopier|sitesucker|offline explorer|teleport|webzip|grabber|scraper|crawler4j/i;

// Next.js 16 renamed Middleware to Proxy (same runtime, same conventions).
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
export async function proxy(request: NextRequest) {
  // /api е отворен: там идват уебхукове, cron и AI агентите (x402).
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua.trim() || KOPIRACHI.test(ua)) {
      return new NextResponse("Достъпът е отказан.", { status: 403 });
    }
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
