import { NextResponse, type NextRequest } from "next/server";
import { withX402 } from "@x402/next";
import { toAgentTender } from "@/lib/agent-format";
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

// withX402 подава само заявката, затова id-то се чете от пътя.
async function handler(request: NextRequest): Promise<NextResponse> {
  const id = Number(request.nextUrl.pathname.split("/").pop());
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "bad_request", message: "id must be a positive integer" }, { status: 400 });
  }
  const tender = await getStore().getTender(id);
  if (!tender) {
    // withX402 прехвърля парите само при отговор под 400, така че за
    // несъществуваща поръчка агентът не плаща.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json(toAgentTender(tender, true), { headers: { "Cache-Control": "no-store" } });
}

const routeConfig = paidRoute({
  price: X402_PRICES.tender,
  description: "One Bulgarian public procurement tender with its full description in Bulgarian.",
  tags: ["detail"],
  inputSchema: { type: "object", properties: {} },
  outputExample: {
    id: 554375,
    url: `${SITE_URL}/tenders/554375`,
    title: "Доставка на гориво бензин А-95H",
    estimated_value_eur: 652600,
    deadline_utc: "2026-10-19T20:59:59.000Z",
    description_bg: "Предмет на настоящата обществена поръчка е доставка чрез покупка на гориво бензин А-95H…",
  },
});

export const GET = isX402Configured
  ? withX402(handler, { "/api/agent/tenders/[id]": routeConfig }, getX402Server())
  : async () => x402NotConfiguredResponse();
