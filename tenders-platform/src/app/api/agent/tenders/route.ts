import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "@x402/next";
import { toAgentTender } from "@/lib/agent-format";
import { CPV_DIVISIONS } from "@/lib/eop/cpv";
import { REGIONS } from "@/lib/eop/regions";
import { filtersFromParams } from "@/lib/filters";
import { SITE_URL } from "@/lib/site";
import { getStore } from "@/lib/store";
import {
  X402_PRICES,
  getX402Server,
  isX402Configured,
  paidRoute,
  x402NotConfiguredResponse,
} from "@/lib/x402/server";

export const dynamic = "force-dynamic";

const ROUTE_PATH = "/api/agent/tenders";
const MAX_LIMIT = 50;

async function handler(request: NextRequest): Promise<NextResponse> {
  const p = request.nextUrl.searchParams;
  const filters = filtersFromParams({
    q: p.get("q") ?? undefined,
    category: p.get("category") ?? undefined,
    region: p.get("region") ?? undefined,
    min: p.get("min_value") ?? undefined,
    max: p.get("max_value") ?? undefined,
    sort: p.get("sort") ?? undefined,
    all: p.get("open_only") === "false" ? "1" : undefined,
  });
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(p.get("limit")) || 20));
  const offset = Math.max(0, Number(p.get("offset")) || 0);

  const { rows, total } = await getStore().searchTenders({ ...filters, limit, offset });
  return NextResponse.json(
    {
      source: SITE_URL,
      total,
      offset,
      limit,
      tenders: rows.map((t) => toAgentTender(t)),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const routeConfig = paidRoute({
  price: X402_PRICES.search,
  description:
    "Search Bulgarian public procurement tenders (national e-procurement system CAIS EOP, incl. below-EU-threshold) by keyword, CPV division, NUTS-3 region, value and deadline. Cleaned daily.",
  tags: ["search"],
  inputSchema: {
    type: "object",
    properties: {
      q: { type: "string", description: "Keywords in Bulgarian" },
      category: { type: "string", enum: Object.keys(CPV_DIVISIONS), description: "CPV division" },
      region: { type: "string", enum: Object.keys(REGIONS), description: "NUTS-3 code" },
      min_value: { type: "number", description: "EUR" },
      max_value: { type: "number", description: "EUR" },
      open_only: { type: "boolean", default: true },
      sort: { type: "string", enum: ["deadline", "newest", "value"] },
      limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
      offset: { type: "integer", minimum: 0 },
    },
  },
  outputExample: {
    source: SITE_URL,
    total: 1,
    offset: 0,
    limit: 20,
    tenders: [
      {
        id: 554375,
        url: `${SITE_URL}/tenders/554375`,
        official_url: "https://app.eop.bg/today/554375",
        procurement_number: "00265-2026-0031",
        title: "Доставка на гориво бензин А-95H",
        lot: null,
        buyer: { name: "МИНИ МАРИЦА - ИЗТОК ЕАД", eik: "833017552", type: "Публично предприятие", locality: "гр. Раднево" },
        region: { nuts3: "BG344", name: "Стара Загора" },
        category: { cpv_division: "09", name_bg: "Горива, нефтопродукти и енергия" },
        cpv: { code: "09132100", label_bg: "Безоловен бензин" },
        contract_type_bg: "Доставки",
        procedure_bg: "Договаряне без предварителна покана за участие",
        estimated_value_eur: 652600,
        deadline_utc: "2026-10-19T20:59:59.000Z",
        published_utc: "2026-10-02T09:55:33.493Z",
        eu_funded: false,
        eu_program: null,
        cancelled: false,
      },
    ],
  },
});

export const GET = isX402Configured
  ? withX402(handler, { [ROUTE_PATH]: routeConfig }, getX402Server())
  : async () => x402NotConfiguredResponse();
