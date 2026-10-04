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

const ROUTE_PATH = "/api/agent/listings";
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const DEAL_TYPES: ListingDealType[] = ["rent", "sale"];
const PROPERTY_TYPES: PropertyType[] = [
  "apartment",
  "house",
  "plot",
  "office",
  "shop",
];

function numberParam(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Платено търсене на активни обяви за AI агенти.
 *
 * Нарочно НЕ връща телефон, адрес и име на собственика — те са за хора,
 * след безплатна регистрация на сайта (виж бизнес модела в CLAUDE.md).
 * Връщаме обществените полета, които и анонимен посетител вижда в списъка,
 * плюс цена на кв.м и линк към обявата, за да води агентът трафик към нас.
 */
async function handler(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  const deal = params.get("deal");
  const property = params.get("property");
  const city = params.get("city")?.trim() ?? "";
  const priceMin = numberParam(params.get("price_min"));
  const priceMax = numberParam(params.get("price_max"));
  const areaMin = numberParam(params.get("area_min"));
  const areaMax = numberParam(params.get("area_max"));
  const roomsMin = numberParam(params.get("rooms_min"));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, numberParam(params.get("limit")) ?? DEFAULT_LIMIT),
  );
  const offset = Math.max(0, numberParam(params.get("offset")) ?? 0);

  if (deal && !DEAL_TYPES.includes(deal as ListingDealType)) {
    return NextResponse.json(
      { error: "bad_request", message: "deal must be sale or rent" },
      { status: 400 },
    );
  }
  if (property && !PROPERTY_TYPES.includes(property as PropertyType)) {
    return NextResponse.json(
      {
        error: "bad_request",
        message: `property must be one of ${PROPERTY_TYPES.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  // `cities!inner` прави join-а задължителен, за да може филтърът по име
  // на града да се приложи върху свързаната таблица.
  let query = supabase
    .from("listings")
    .select(
      "id, type, property_type, price, area_sqm, rooms, floor, year_built, heating, has_parking, has_elevator, has_terrace, is_furnished, title, created_at, last_confirmed_at, cities!inner(name, region), neighborhoods(name)",
      { count: "exact" },
    )
    .eq("status", "active");

  if (deal) query = query.eq("type", deal as ListingDealType);
  if (property) query = query.eq("property_type", property as PropertyType);
  if (city) query = query.ilike("cities.name", `%${city}%`);
  if (priceMin !== null) query = query.gte("price", priceMin);
  if (priceMax !== null) query = query.lte("price", priceMax);
  if (areaMin !== null) query = query.gte("area_sqm", areaMin);
  if (areaMax !== null) query = query.lte("area_sqm", areaMax);
  if (roomsMin !== null) query = query.gte("rooms", roomsMin);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json(
      { error: "upstream_error", message: error.message },
      { status: 502 },
    );
  }

  type Row = {
    id: string;
    type: ListingDealType;
    property_type: PropertyType;
    price: number;
    area_sqm: number;
    rooms: number | null;
    floor: number | null;
    year_built: number | null;
    heating: string | null;
    has_parking: boolean;
    has_elevator: boolean;
    has_terrace: boolean;
    is_furnished: boolean;
    title: string;
    created_at: string;
    last_confirmed_at: string;
    cities: { name: string; region: string } | null;
    neighborhoods: { name: string } | null;
  };

  const rows = (data ?? []) as unknown as Row[];

  const listings = rows.map((row) => ({
    id: row.id,
    url: `${SITE_URL}/listings/${row.id}`,
    deal: row.type,
    property: row.property_type,
    city: row.cities?.name ?? null,
    region: row.cities?.region ?? null,
    neighborhood: row.neighborhoods?.name ?? null,
    price_eur: Number(row.price),
    area_sqm: Number(row.area_sqm),
    price_per_sqm_eur:
      Number(row.area_sqm) > 0
        ? Math.round(Number(row.price) / Number(row.area_sqm))
        : null,
    rooms: row.rooms,
    floor: row.floor,
    year_built: row.year_built,
    heating: row.heating,
    has_parking: row.has_parking,
    has_elevator: row.has_elevator,
    has_terrace: row.has_terrace,
    is_furnished: row.is_furnished,
    title: row.title,
    posted_at: row.created_at,
    last_confirmed_at: row.last_confirmed_at,
  }));

  return NextResponse.json(
    {
      source: SITE_URL,
      currency: "EUR",
      total: count ?? listings.length,
      offset,
      limit,
      listings,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

const routeConfig = paidRoute({
  price: X402_PRICES.listings,
  description:
    "Search active owner-posted real estate listings in Bulgaria (sale/rent, apartments, houses, plots, offices, shops) with price, area, rooms and location.",
  tags: ["search"],
  inputSchema: {
    type: "object",
    properties: {
      deal: { type: "string", enum: DEAL_TYPES },
      property: { type: "string", enum: PROPERTY_TYPES },
      city: { type: "string", description: "City name, partial match (Cyrillic as on the site)" },
      price_min: { type: "number", description: "EUR" },
      price_max: { type: "number", description: "EUR" },
      area_min: { type: "number", description: "square metres" },
      area_max: { type: "number", description: "square metres" },
      rooms_min: { type: "integer" },
      limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT },
      offset: { type: "integer", minimum: 0 },
    },
  },
  outputExample: {
    source: SITE_URL,
    currency: "EUR",
    total: 1,
    offset: 0,
    limit: 20,
    listings: [
      {
        id: "7f1b7e5e-2b0f-4e6e-9d7c-1a2b3c4d5e6f",
        url: `${SITE_URL}/listings/7f1b7e5e-2b0f-4e6e-9d7c-1a2b3c4d5e6f`,
        deal: "sale",
        property: "apartment",
        city: "Пловдив",
        region: "Пловдив",
        neighborhood: "Кършияка",
        price_eur: 125000,
        area_sqm: 78,
        price_per_sqm_eur: 1603,
        rooms: 3,
        floor: 4,
        year_built: 2015,
        heating: "Климатик",
        has_parking: true,
        has_elevator: true,
        has_terrace: true,
        is_furnished: false,
        title: "Тристаен, Кършияка, тухла, с паркомясто",
        posted_at: "2026-09-20T10:00:00.000Z",
        last_confirmed_at: "2026-09-27T10:00:00.000Z",
      },
    ],
  },
});

// Без портфейл route-ът не е платен, а честно казва, че не е включен.
export const GET = isX402Configured
  ? withX402(handler, { [ROUTE_PATH]: routeConfig }, getX402Server())
  : async () => x402NotConfiguredResponse();
