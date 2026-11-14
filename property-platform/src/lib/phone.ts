import "server-only";
import type { createClient } from "@/lib/supabase/server";

export const PHONE_TAKEN_MESSAGE =
  "Този телефон вече се ползва от друг профил. Влез в него или ни пиши.";

const MESSAGES = {
  nevaliden:
    "Въведи валиден телефон. Чуждите номера са с код на държавата, например +49 170 1234567.",
  zaet: PHONE_TAKEN_MESSAGE,
  blokiran: "Този телефон е блокиран за регистрация.",
} as const;

/**
 * Тайният низ, с който сървърът се представя на базата. Има го само в
 * production; локално и в preview липсва и предварителните проверки се
 * прескачат. Правилата в базата (тригерите) важат и без тях.
 */
function taenNiz() {
  const taen = process.env.REMINDERS_DB_SECRET;
  if (!taen && process.env.VERCEL_ENV === "production") {
    console.error("REMINDERS_DB_SECRET липсва: проверките за телефон са прескочени");
  }
  return taen ?? null;
}

// Самото правило е в базата (20261101090000_telefon_edinstven.sql). Тук
// само се взема ясният текст за формата, преди да се пише. Функцията в
// базата иска тайния низ, за да не може да се пита направо отвън кой
// номер има профил.
export async function checkPhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string,
) {
  const taen = taenNiz();
  if (!taen) return null;
  const { data, error } = await supabase.rpc("proveri_telefon_srv", {
    p_secret: taen,
    p_phone: phone,
  });
  if (error) {
    return "Телефонът не можа да се провери. Опитай пак.";
  }
  return data === "ok" ? null : MESSAGES[data];
}

/**
 * Блокиран ли е телефонът или имейлът. `error` е true, ако проверката не
 * е минала; без тайния низ връща „не е блокиран“ и оставя базата да реши.
 */
export async function blokiranKontakt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string | null,
  email: string | null,
) {
  const taen = taenNiz();
  if (!taen) return { blokiran: false, error: false };
  const { data, error } = await supabase.rpc("blokiran_kontakt_srv", {
    p_secret: taen,
    p_phone: phone,
    p_email: email,
  });
  if (error) console.error("blokiran_kontakt_srv", error.message);
  return { blokiran: data === true, error: Boolean(error) };
}

/**
 * Само вътрешни адреси. `//чужд-сайт` и `/\\чужд-сайт` също започват с
 * наклонена черта, а браузърът ги чете като друг сайт. Затова адресът се
 * сглобява спрямо измислен домейн и се приема само ако остане в него.
 */
/** Страницата за нова парола, към която води линкът от писмото. */
export const NOVA_PAROLA_PAT = "/nova-parola";

export function safeNext(next: string | null | undefined) {
  if (!next || !next.startsWith("/") || /[\\\u0000-\u001f]/.test(next)) {
    return "/dashboard";
  }
  try {
    const url = new URL(next, "http://vatre.invalid");
    if (url.origin !== "http://vatre.invalid") return "/dashboard";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/dashboard";
  }
}
