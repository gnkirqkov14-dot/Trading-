import { cronAuthorized } from "@/lib/cron";
import { emailEnabled, sendDigestEmail } from "@/lib/email";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Колко поръчки слагаме в едно писмо; останалите са „и още N“. */
const MAX_PER_EMAIL = 25;

/**
 * Всяка сутрин след вноса (vercel.json, 08:00 UTC): на всеки активен
 * абонат праща новите или променени поръчки по неговите условия, откакто
 * му е писано за последно. Ако няма нищо ново — не пише.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  if (!emailEnabled) return Response.json({ ok: true, skipped: "RESEND_API_KEY липсва" });

  const store = getStore();
  const subs = await store.activeSubscriptions();
  const startedAt = new Date().toISOString();
  let sent = 0;
  const errors: string[] = [];

  for (const sub of subs) {
    // Първото писмо покрива последното денонощие преди потвърждението.
    const since =
      sub.last_sent_at ??
      new Date(Date.parse(sub.confirmed_at ?? sub.created_at) - 86_400_000).toISOString();
    try {
      const { rows, total } = await store.searchTenders({
        q: sub.q ?? undefined,
        region: sub.region_code ?? undefined,
        category: sub.cpv_division ?? undefined,
        minValue: sub.min_value ?? undefined,
        updatedSince: since,
        openOnly: true,
        sort: "deadline",
        limit: MAX_PER_EMAIL,
      });
      if (rows.length > 0) {
        await sendDigestEmail(sub.email, sub.token, rows, total - rows.length);
        sent++;
      }
      await store.markSubscriptionSent(sub.id, startedAt);
    } catch (error) {
      errors.push(`${sub.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return Response.json({ ok: errors.length === 0, subscribers: subs.length, sent, errors });
}
