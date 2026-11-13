import type { createClient } from "@/lib/supabase/server";

export const PHONE_TAKEN_MESSAGE =
  "Този телефон вече се ползва от друг профил. Влез в него или ни пиши.";

const MESSAGES = {
  nevaliden:
    "Въведи валиден телефон. Чуждите номера са с код на държавата, например +49 170 1234567.",
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
