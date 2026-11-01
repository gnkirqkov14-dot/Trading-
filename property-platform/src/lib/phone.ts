import type { createClient } from "@/lib/supabase/server";

export const PHONE_TAKEN_MESSAGE =
  "Този телефон вече се ползва от друг профил. Влез в него или ни пиши.";

const MESSAGES = {
  nevaliden: "Въведи български мобилен номер, например 0888 123 456.",
  zaet: PHONE_TAKEN_MESSAGE,
  blokiran: "Този телефон е блокиран за регистрация.",
} as const;

// Самото правило е в базата (20261101090000_telefon_edinstven.sql). Тук
// само се взема ясният текст за формата, преди да се пише.
export async function checkPhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string,
) {
  const { data, error } = await supabase.rpc("proveri_telefon", {
    p_phone: phone,
  });
  if (error) {
    return "Телефонът не можа да се провери. Опитай пак.";
  }
  return data === "ok" ? null : MESSAGES[data];
}

/** Само вътрешни адреси: `//чужд-сайт` също започва с наклонена черта. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/dashboard";
}
