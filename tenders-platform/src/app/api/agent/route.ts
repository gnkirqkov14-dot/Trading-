import { CPV_DIVISIONS } from "@/lib/eop/cpv";
import { REGIONS } from "@/lib/eop/regions";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  X402_FACILITATOR_URL,
  X402_IS_TESTNET,
  X402_NETWORK,
  X402_PRICES,
  X402_SERVICE_NAME,
  isX402Configured,
} from "@/lib/x402/server";

export const dynamic = "force-dynamic";

/**
 * Безплатен каталог за AI агенти: какво има, колко струва и как се плаща.
 * Откриването е безплатно, плаща се само изпълнението.
 */
export async function GET() {
  return Response.json(
    {
      service: X402_SERVICE_NAME,
      name: `${SITE_NAME}: Bulgarian public procurement tenders`,
      description:
        "Every public procurement tender published in Bulgaria's national e-procurement system (CAIS EOP), including below-EU-threshold tenders that are not in TED. Cleaned and normalized daily: deadlines in UTC, values in EUR, NUTS-3 regions, CPV categories.",
      source: {
        name: "ЦАИС ЕОП open data, Public Procurement Agency of Bulgaria",
        url: "https://app.eop.bg/today/reporting/open-data",
        license: "CC0 (as declared in the official OCDS files)",
        update: "daily, around 07:30 UTC",
      },
      payment: {
        protocol: "x402",
        spec: "https://x402.org",
        enabled: isX402Configured,
        network: X402_NETWORK,
        testnet: X402_IS_TESTNET,
        currency: "USDC",
        facilitator: X402_FACILITATOR_URL,
        how: "Call a paid endpoint without payment to receive HTTP 402 with a PAYMENT-REQUIRED header, sign the USDC amount and retry with a PAYMENT-SIGNATURE header. Clients: @x402/fetch (JS), x402 (Python).",
      },
      endpoints: [
        {
          method: "GET",
          url: `${SITE_URL}/api/agent/tenders`,
          price: X402_PRICES.search,
          unit: "per request, up to 50 tenders",
          params: {
            q: "keywords in Bulgarian, all must match (title, lot, buyer, CPV label, locality)",
            category: "CPV division, 2 digits, e.g. 45 = construction works",
            region: "NUTS-3 code, e.g. BG421 = Plovdiv",
            min_value: "minimum estimated value in EUR",
            max_value: "maximum estimated value in EUR",
            open_only: "true (default) = deadline not passed and not cancelled",
            sort: "deadline (default) | newest | value",
            limit: "1-50, default 20",
            offset: "pagination offset",
          },
        },
        {
          method: "GET",
          url: `${SITE_URL}/api/agent/tenders/{id}`,
          price: X402_PRICES.tender,
          unit: "per tender, with full description",
        },
      ],
      reference: { categories: CPV_DIVISIONS, regions: REGIONS },
      human_site: SITE_URL,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
