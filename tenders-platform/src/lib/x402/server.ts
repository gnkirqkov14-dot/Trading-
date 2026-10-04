import "server-only";

import { SITE_URL } from "@/lib/site";
import {
  HTTPFacilitatorClient,
  x402ResourceServer,
  type RouteConfig,
} from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";

/**
 * „Касата“ за AI агенти — протокол x402 (HTTP 402 Payment Required).
 *
 * Как работи, с две изречения: агент вика платен адрес под `/api/agent/*`
 * без плащане и получава 402 с цена, валута (USDC) и нашия портфейл.
 * Той подписва микроплащане, повтаря заявката с хедър `PAYMENT-SIGNATURE`,
 * посредникът (facilitator) проверява и сетълва трансфера на блокчейн, а
 * ние връщаме данните. Няма акаунти, API ключове и фактури.
 *
 * Същото като в property-platform (imotpoint). Всичко се управлява от три
 * променливи на средата (виж `.env.local.example` и docs/РЪЧНИ-СТЪПКИ.md):
 *
 * - `X402_PAY_TO`          — нашият адрес на портфейл (0x...). Без него
 *                            платените route-ове отговарят 503 и обясняват
 *                            какво липсва; сайтът за хора не се влияе.
 * - `X402_NETWORK`         — `eip155:84532` (Base Sepolia, тестова мрежа,
 *                            по подразбиране) или `eip155:8453` (Base,
 *                            истински пари).
 * - `X402_FACILITATOR_URL` — посредникът; по подразбиране публичният на
 *                            Coinbase, който е безплатен.
 *
 * Паричните суми тук са в долари като низ (`"$0.002"`): библиотеката ги
 * превръща в USDC по подразбиращия се актив за мрежата.
 */

export const X402_NETWORK = (process.env.X402_NETWORK ??
  "eip155:84532") as Network;
export const X402_PAY_TO = (process.env.X402_PAY_TO ?? "").trim();
export const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

export const X402_IS_TESTNET = X402_NETWORK === "eip155:84532";

/** Адресът е 0x + 40 шестнайсетични знака. Всичко друго е грешка при копиране. */
export const isX402Configured = /^0x[0-9a-fA-F]{40}$/.test(X402_PAY_TO);


/** Име на услугата, както я виждат агентите в каталозите (Bazaar). */
export const X402_SERVICE_NAME = "bulgaria-public-tenders";

/**
 * Ценоразпис на платените крайни точки — на едно място, за да го четат и
 * route-овете, и безплатният каталог `/api/agent`, и документацията.
 * Ориентир от пазара: скрейпъри за поръчки взимат 3–8 $ на 1000 записа,
 * а API-та за поръчки 0,14–0,46 £ на заявка. Ние сме в долния край, но
 * даваме изчистени и филтрирани данни, до 50 поръчки на заявка.
 */
export const X402_PRICES = {
  search: "$0.01",
  tender: "$0.002",
} as const;

let server: x402ResourceServer | null = null;

/**
 * Един сървър за целия процес (Vercel държи модула топъл между заявки).
 * Регистрираме само EVM схемата „exact“ за избраната мрежа — това е
 * USDC трансфер по EIP-3009, без газ за платеца.
 */
export function getX402Server(): x402ResourceServer {
  if (!server) {
    const facilitator = new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL });
    server = new x402ResourceServer(facilitator)
      .register(X402_NETWORK, new ExactEvmScheme())
      .registerExtension(bazaarResourceServerExtension);
  }
  return server;
}

type PaidRouteOptions = {
  /** Цена като низ в долари, напр. "$0.002". */
  price: string;
  /** Едно изречение на английски — това е „витрината“ в каталозите на агентите. */
  description: string;
  /** JSON Schema на query параметрите (за откриваемост в Bazaar). */
  inputSchema: Record<string, unknown>;
  /** Примерен отговор — агентите го четат, за да решат дали да платят. */
  outputExample: unknown;
  tags?: string[];
};

/**
 * Обща конфигурация за един платен GET route. 402 отговорът без плащане
 * връща и човешки четимо обяснение (`unpaidResponseBody`), за да не е
 * празен за разработчик, който го отваря с curl.
 */
export function paidRoute({
  price,
  description,
  inputSchema,
  outputExample,
  tags = [],
}: PaidRouteOptions): RouteConfig {
  return {
    accepts: [
      {
        scheme: "exact",
        price,
        network: X402_NETWORK,
        payTo: X402_PAY_TO,
        maxTimeoutSeconds: 60,
      },
    ],
    description,
    mimeType: "application/json",
    serviceName: X402_SERVICE_NAME,
    tags: ["public-procurement", "tenders", "bulgaria", "government", ...tags],
    unpaidResponseBody: () => ({
      contentType: "application/json",
      body: {
        error: "payment_required",
        message:
          "This endpoint is paid via the x402 protocol. Retry with a PAYMENT-SIGNATURE header (see https://x402.org). Free catalog: " +
          `${SITE_URL}/api/agent`,
        price,
        network: X402_NETWORK,
        testnet: X402_IS_TESTNET,
      },
    }),
    extensions: declareDiscoveryExtension({
      inputSchema,
      output: { example: outputExample },
    }),
  };
}

/**
 * Отговорът на платените route-ове, докато собственикът не е сложил
 * портфейл. Нарочно 503, не 402: агентът да не опитва да плаща на празен
 * адрес, а човекът да види какво липсва.
 */
export function x402NotConfiguredResponse() {
  return Response.json(
    {
      error: "x402_not_configured",
      message:
        "Paid agent endpoints are not enabled yet: the X402_PAY_TO wallet address is missing on the server.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
