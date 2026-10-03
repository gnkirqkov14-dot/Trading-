import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "@x402/next";
import { createClient } from "@/lib/supabase/server";
import type { ListingDealType, PropertyType } from "@/lib/types/database";
import {
  SITE_URL,
  X402_PRICES,
  getX402Server,
  isX402Configured,
  paidRoute,
  x402NotConfiguredResponse,
} from "@/lib/x402/server";

export const dynamic = "force-dynamic";

const ROUTE_PATH = "/api/agent/price-index";

/** Таван на редовете за една сметка — при повече ще мине на SQL (RPC). */
const MAX_ROWS = 5000;

/** Под толкова обяви медианата е по-скоро анекдот, отколкото статистика. */
const SMALL_SAMPLE = 5;

const DEAL_TYPES: ListingDealType[] = ["rent", "sale"];
const PROPERTY_TYPES: PropertyType[] = [
  "apartment",
  "house",
  "plot",
  "office",
  "shop",
];

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Платен ценови индекс: цена на кв.м по град (или по квартал, ако е
 * подаден град). Това е най-„мръсният“ от нашите данни за почистване за
 * агенти — тук го връщаме готово сметнато вместо суров списък.
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const deal = (params.get("deal") ?? "sale") as ListingDealType;
  const property = (params.get("property") ?? "apartment") as PropertyType;
  const city = params.get("city")?.trim() ?? "";

  if (!DEAL_TYPES.includes(deal)) {
    return NextResponse.json(
      { error: "bad_request", message: "deal must be sale or rent" },
      { status: 400 },
    );
  }
  if (!PROPERTY_TYPES.includes(property)) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: `property must be one of ${PROPERTY_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select(
      "price, area_sqm, cities!inner(name, region), neighborhoods(name)",
    )
    .eq("status", "active")
    .eq("type", deal)
    .eq("property_type", property)
    .gt("area_sqm", 0);

  if (city) query = query.ilike("cities.name", `%${city}%`);

  const { data, error } = await query.limit(MAX_ROWS);

  if (error) {
    return NextResponse.json(
      { error: "upstream_error", message: error.message },
      { status: 502 },
    );
  }

  type Row = {
    price: number;
    area_sqm: number;
    cities: { name: string; region: string } | null;
    neighborhoods: { name: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  // Групираме по град; ако е подаден град — по квартал в него.
  const groups = new Map<
    string,
    { city: string; region: string | null; neighborhood: string | null; values: number[] }
  >();

  for (const row of rows) {
    const cityName = row.cities?.name ?? "—";
    const neighborhood = city ? (row.neighborhoods?.name ?? "—") : null;
    const key = city ? `${cityName}::${neighborhood}` : cityName;
    const perSqm = Number(row.price) / Number(row.area_sqm);
    if (!Number.isFinite(perSqm) || perSqm <= 0) continue;

    const group = groups.get(key) ?? {
      city: cityName,
      region: row.cities?.region ?? null,
      neighborhood,
      values: [],
    };
    group.values.push(perSqm);
    groups.set(key, group);
  }

  const index = [...groups.values()]
    .map((group) => {
      const sorted = [...group.values].sort((a, b) => a - b);
      const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
      return {
        city: group.city,
        region: group.region,
        neighborhood: group.neighborhood,
        listings: sorted.length,
        median_eur_per_sqm: Math.round(median(sorted)),
        mean_eur_per_sqm: Math.round(mean),
        min_eur_per_sqm: Math.round(sorted[0]),
        max_eur_per_sqm: Math.round(sorted[sorted.length - 1]),
        small_sample: sorted.length < SMALL_SAMPLE,
      };
    })
    .sort((a, b) => b.listings - a.listings);

  return NextResponse.json(
    {
      source: SITE_URL,
      currency: "EUR",
      deal,
      property,
      city: city || null,
      grouped_by: city ? "neighborhood" : "city",
      computed_at: new Date().toISOString(),
      total_listings: rows.length,
      note:
        "Owner-posted asking prices, not transaction prices. Groups flagged small_sample have fewer than 5 listings.",
      index,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const routeConfig = paidRoute({
  price: X402_PRICES.priceIndex,
  description:
    "Asking price per square metre statistics (median, mean, min, max, count) for Bulgarian real estate, grouped by city or by neighborhood within a city.",
  tags: ["statistics", "price-index"],
  inputSchema: {
    type: "object",
    properties: {
      deal: { type: "string", enum: DEAL_TYPES, default: "sale" },
      property: { type: "string", enum: PROPERTY_TYPES, default: "apartment" },
      city: {
        type: "string",
        description: "Optional city name; when given, groups by neighborhood",
      },
    },
  },
  outputExample: {
    source: SITE_URL,
    currency: "EUR",
    deal: "sale",
    property: "apartment",
    city: null,
    grouped_by: "city",
    computed_at: "2026-10-01T12:00:00.000Z",
    total_listings: 312,
    note: "Owner-posted asking prices, not transaction prices.",
    index: [
      {
        city: "София",
        region: "София-град",
        neighborhood: null,
        listings: 140,
        median_eur_per_sqm: 2150,
        mean_eur_per_sqm: 2290,
        min_eur_per_sqm: 980,
        max_eur_per_sqm: 5400,
        small_sample: false,
      },
    ],
  },
});

export const GET = isX402Configured
  ? withX402(handler, { [ROUTE_PATH]: routeConfig }, getX402Server())
  : async () => x402NotConfiguredResponse();
