import "server-only";
import { headers } from "next/headers";
import type { createClient } from "@/lib/supabase/server";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Телефонът се крие зад „не съм робот“ само ако има и двата ключа. */
export function telefonSProverka() {
  return Boolean(TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

/**
 * Телефонът на обява. Функцията в базата иска тайния низ на сървъра, за да
 * не може да се вика направо с профил на робот. Връща null, ако низът липсва
 * (локално и в preview) или контактите на обявата не са отворени.
 */
export async function telefonNaObyava(supabase: Supabase, listingId: string) {
  const taen = process.env.REMINDERS_DB_SECRET;
  if (!taen) return null;
  const { data, error } = await supabase.rpc("obyava_telefon", {
    p_id: listingId,
    p_secret: taen,
  });
  if (error) {
    console.error("obyava_telefon", error.message);
    return null;
  }
  return data;
}

/** Пита Cloudflare дали жетонът от джаджата е истински. */
export async function proveriTurnstile(token: string) {
  const taen = process.env.TURNSTILE_SECRET_KEY;
  if (!taen || !token) return false;
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim();
  const telo = new URLSearchParams({ secret: taen, response: token });
  if (ip) telo.set("remoteip", ip);
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: telo },
    );
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error("turnstile", err);
    return false;
  }
}
