import { createClient } from "@/lib/supabase/server";
import { sendListingReminderEmail } from "@/lib/email";

// Triggered daily by Vercel Cron (see vercel.json). Runs the 3-stage
// reminder schedule (process_listing_reminders(), see
// 0013_listing_reminder_schedule.sql): day 7 -> first reminder, day 14 ->
// second reminder + status "expired", day 21 -> status "archived". Emails
// are best-effort (sendListingReminderEmail no-ops without RESEND_API_KEY)
// — the in-app banner in my-listings.tsx always reflects the real state
// regardless of whether email is configured.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("process_listing_reminders");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const results = await Promise.allSettled(
    rows.map((row) => sendListingReminderEmail(row)),
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;

  return Response.json({ ok: true, processed: rows.length, sent, failed });
}
