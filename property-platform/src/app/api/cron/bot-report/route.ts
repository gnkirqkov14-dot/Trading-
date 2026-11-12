import { otkazZaCron } from "@/lib/cron-auth";
import { createClient } from "@/lib/supabase/server";
import { sendBotReportEmail } from "@/lib/email";

// Всяка сутрин (vercel.json): ако през последните 24 часа proxy.ts е
// спрял копирачи, собственикът получава имейл кои и колко. Без опити
// писмо не се праща.
export async function GET(request: Request) {
  const otkaz = otkazZaCron(request);
  if (otkaz) return otkaz;

  const secret = process.env.REMINDERS_DB_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "REMINDERS_DB_SECRET is not set" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bot_otchet", {
    p_secret: secret,
    p_chasa: 24,
  });
  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }

  const report = data;
  if (report.zayavki > 0) await sendBotReportEmail(report);

  return Response.json({ ok: true, zayavki: report.zayavki });
}
