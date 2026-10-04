import { createClient } from "@/lib/supabase/server";
import { sendListingReminderEmail } from "@/lib/email";

// Triggered daily by Vercel Cron (see vercel.json). Runs the 3-stage
// reminder schedule (process_listing_reminders(), see
// 0013_listing_reminder_schedule.sql): day 7 -> first reminder, day 14 ->
// second reminder + status "expired", day 21 -> status "archived". Emails
// are best-effort (sendListingReminderEmail no-ops without RESEND_API_KEY)
// — the in-app banner in my-listings.tsx always reflects the real state
// regardless of whether email is configured.
//
// The function returns owners' emails, so the database only runs it with
// REMINDERS_DB_SECRET (0034_lock_listing_reminders.sql) — the anon key alone
// is not enough. Without the env var we fail here with a clear message
// instead of a bare "forbidden" from Postgres.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const secret = process.env.REMINDERS_DB_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "REMINDERS_DB_SECRET is not set" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("process_listing_reminders", {
    p_secret: secret,
  });

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
