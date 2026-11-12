"use server";

import { createClient } from "@/lib/supabase/server";
import { proveriTurnstile, telefonNaObyava } from "@/lib/telefon";
import { TURNSTILE_GRESHKA } from "@/lib/turnstile";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** „Покажи телефона“: първо „не съм робот“, после номерът. */
export async function pokazhiTelefon(
  listingId: string,
  token: string,
): Promise<{ phone: string } | { error: string }> {
  if (!UUID.test(listingId)) return { error: "Няма такава обява." };
  if (!(await proveriTurnstile(token))) return { error: TURNSTILE_GRESHKA };

  const supabase = await createClient();
  const phone = await telefonNaObyava(supabase, listingId);
  if (!phone) {
    return { error: "Не успяхме да покажем телефона. Презареди страницата." };
  }
  return { phone };
}
