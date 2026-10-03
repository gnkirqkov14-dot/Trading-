import {
  SITE_URL,
  X402_FACILITATOR_URL,
  X402_IS_TESTNET,
  X402_NETWORK,
  X402_PRICES,
  X402_SERVICE_NAME,
  isX402Configured,
} from "@/lib/x402/server";

export const dynamic = "force-dynamic";

/**
 * Безплатен каталог на платените крайни точки за AI агенти.
 *
 * Правило от практиката на x402: откриването е безплатно, плаща се само
 * изпълнението. Агент (или човек с curl) чете оттук какво предлагаме, на
 * каква цена и как се плаща, преди да похарчи и цент. Текстът е на
 * английски нарочно — това е езикът на агентите и на каталозите.
 */
export async function GET() {
  const body = {
    service: X402_SERVICE_NAME,
    name: "imotpoint.com — owner-direct real estate listings in Bulgaria",
    description:
      "Structured, deduplicated, owner-posted property listings (sale and rent) across Bulgaria with city, neighborhood, price, area and features. Fresh data: every listing is re-confirmed by its owner or expires.",
    payment: {
      protocol: "x402",
      spec: "https://x402.org",
      enabled: isX402Configured,
      network: X402_NETWORK,
      testnet: X402_IS_TESTNET,
      currency: "USDC",
      facilitator: X402_FACILITATOR_URL,
      how: "Call a paid endpoint without payment to receive HTTP 402 with a PAYMENT-REQUIRED header. Sign the requested USDC amount and retry with a PAYMENT-SIGNATURE header. Clients: @x402/fetch (JS), x402 (Python).",
    },
    endpoints: [
      {
        method: "GET",
        url: `${SITE_URL}/api/agent/listings`,
        price: X402_PRICES.listings,
        unit: "per request (up to 50 listings)",
        description:
          "Search active listings. Query params: deal=sale|rent, property=apartment|house|plot|office|shop, city=<name, partial, Cyrillic or Latin not normalized>, price_min, price_max (EUR), area_min, area_max (sqm), rooms_min, limit (1-50), offset.",
      },
      {
        method: "GET",
        url: `${SITE_URL}/api/agent/price-index`,
        price: X402_PRICES.priceIndex,
        unit: "per request",
        description:
          "Price per square metre statistics (count, median, mean, min, max) grouped by city, or by neighborhood when city=<name> is given. Query params: deal=sale|rent (default sale), property=apartment|house|plot|office|shop (default apartment), city.",
      },
    ],
    terms: {
      currency_of_prices_in_data: "EUR",
      attribution: `Please link back to ${SITE_URL}/listings/{id} when you show a listing.`,
      no_personal_data:
        "Owner names, phone numbers and exact addresses are never included. Contact happens on the site after free registration.",
      rate_limits: "Be reasonable; abusive crawling is blocked at the edge.",
    },
    human_site: SITE_URL,
  };

  return Response.json(body, {
    headers: { "Cache-Control": "public, max-age=300" },
  });
}
