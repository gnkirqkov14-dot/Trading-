import { cronAuthorized } from "@/lib/cron";
import { syncGrants } from "@/lib/grants/sync";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Всяка сутрин (vercel.json, 06:45 UTC) опреснява грантовете от ИСУН и
 * плановете (ИГРП). AI чете само новите документи: първото пускане
 * обогатява до 15 процедури и 2 плана, останалите се довършват в
 * следващите дни. `?enrich=N&plans=N` за ръчно пускане с други тавани.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  const url = new URL(request.url);
  const num = (k: string, d: number) => {
    const v = Number(url.searchParams.get(k));
    return Number.isFinite(v) && v >= 0 && url.searchParams.has(k) ? Math.min(v, 40) : d;
  };
  const report = await syncGrants(getStore(), {
    maxEnrich: num("enrich", 15),
    maxPlans: num("plans", 2),
    // 20 секунди резерв преди maxDuration.
    deadline: Date.now() + (maxDuration - 20) * 1000,
  });
  return Response.json({ ok: report.errors.length === 0, ...report });
}
