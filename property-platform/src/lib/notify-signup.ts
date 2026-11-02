import type { createClient } from "@/lib/supabase/server";
import { sendNewSignupEmail } from "@/lib/email";

/**
 * Праща на собственика писмо за нова регистрация — веднъж на човек.
 *
 * Вика се от таблото и от обявата: новият потребител от стената отива
 * направо на обявата, без да минава през таблото. Не се
 * пази отделна опашка: бележката `admin_notified_at` стои на самия
 * профил и функцията в базата я вдига в същата заявка, с която чете реда.
 * Тоест два едновременни отвора на таблото не могат да дадат две писма.
 *
 * Пуска се през `after()`, след като страницата вече е отговорила —
 * никой не чака Resend, за да си види профила. По същата причина всяка
 * грешка тук само се записва: провалено писмо не бива да чупи таблото.
 * Клиентът идва готов: вътре в `after()` `cookies()` е забранено.
 */
export async function notifyAdminOfSignup(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  try {
    const { data, error } = await supabase.rpc("claim_signup_notice");
    if (error) {
      console.error("claim_signup_notice failed", error);
      return;
    }

    const row = data?.[0];
    if (!row) return;

    await sendNewSignupEmail(row);
  } catch (error) {
    console.error("new signup notice failed", error);
  }
}
