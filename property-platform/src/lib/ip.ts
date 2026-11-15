import "server-only";
import { headers } from "next/headers";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Адресът (IP) на посетителя, както го дава Vercel. Пази се само за да
 * се спре блокирана агенция, която се връща с нов профил. Виж
 * 20261115100000_blokiran_bez_vhod_i_ip.sql.
 */
async function ipNaPosetitelya() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
}

/** Записва от кой адрес е влязъл или публикувал потребителят. */
export async function zapomniIp(supabase: Supabase, userId: string) {
  const taen = process.env.REMINDERS_DB_SECRET;
  const ip = await ipNaPosetitelya();
  if (!taen || !ip) return;
  const { error } = await supabase.rpc("zapishi_ip_srv", {
    p_secret: taen,
    p_user: userId,
    p_ip: ip,
  });
  if (error) console.error("zapishi_ip_srv", error.message);
}

/** Блокиран човек е опитал пак: спира се и адресът му. */
export async function blokirayIp(supabase: Supabase) {
  const taen = process.env.REMINDERS_DB_SECRET;
  const ip = await ipNaPosetitelya();
  if (!taen || !ip) return;
  const { error } = await supabase.rpc("blokiray_ip_srv", {
    p_secret: taen,
    p_ip: ip,
  });
  if (error) console.error("blokiray_ip_srv", error.message);
}
