import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Програми, които масово теглят обяви. Google, Bing, AI търсачките и
// SEO ботовете не са тук — те водят хора към сайта.
const KOPIRACHI =
  /python-requests|python-urllib|aiohttp|httpx|scrapy|curl\/|wget|go-http-client|okhttp|java\/|apache-httpclient|libwww-perl|node-fetch|axios|undici|got \(|php\/|guzzle|headlesschrome|phantomjs|puppeteer|playwright|selenium|colly|httrack|webcopier|sitesucker|offline explorer|teleport|webzip|grabber|scraper|crawler4j/i;

// Записва спрения опит, за да стигне до сутрешния отчет
// (app/api/cron/bot-report). IP-то не се пази — само хеш.
async function zapishi(request: NextRequest, ua: string) {
  const secret = process.env.REMINDERS_DB_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret || !url || !key) return;

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const salt = process.env.ASSISTANT_IP_SALT ?? process.env.CRON_SECRET ?? "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(salt + ip),
  );
  const ipHash = Array.from(new Uint8Array(digest).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  await fetch(`${url}/rest/v1/rpc/bot_zapishi`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_secret: secret,
      p_agent: ua || "(празен)",
      p_pat: request.nextUrl.pathname,
      p_ip_hash: ipHash,
    }),
  }).catch(() => {});
}

// Next.js 16 renamed Middleware to Proxy (same runtime, same conventions).
// See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
export async function proxy(request: NextRequest, event: NextFetchEvent) {
  // /api е отворен: там идват уебхукове, cron и AI агентите (x402).
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    const ua = request.headers.get("user-agent") ?? "";
    if (!ua.trim() || KOPIRACHI.test(ua)) {
      event.waitUntil(zapishi(request, ua));
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
