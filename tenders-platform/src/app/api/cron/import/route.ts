import { cronAuthorized } from "@/lib/cron";
import { sofiaYesterday } from "@/lib/eop/import";
import { importCatchUp } from "@/lib/eop/run-import";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Всяка сутрин (vercel.json, 07:30 UTC — след като ЦАИС ЕОП пусне
 * файловете около 06:00 UTC) внася вчерашния ден и наваксва пропуснатите.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const store = getStore();
  const results = await importCatchUp(store, sofiaYesterday());
  const failed = results.some((r) => r.status === "error");
  return Response.json({ ok: !failed, results }, { status: failed ? 500 : 200 });
}
