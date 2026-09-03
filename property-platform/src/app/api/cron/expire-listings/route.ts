import { createClient } from "@/lib/supabase/server";

// Triggered daily by Vercel Cron (see vercel.json). Flips listings that
// haven't been re-confirmed by their owner within 7 days from "active"
// to "expired" — they stay visible (sink in ranking), never deleted.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("expire_stale_listings");

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
