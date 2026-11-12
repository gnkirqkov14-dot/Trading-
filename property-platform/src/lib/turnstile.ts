/**
 * Проверката „не съм робот“ (Cloudflare Turnstile).
 *
 * Без `NEXT_PUBLIC_TURNSTILE_SITE_KEY` нищо не се показва и сайтът работи
 * както преди. При вход и регистрация жетонът се проверява от Supabase
 * (Authentication → Attack Protection); при „Покажи телефона“ го проверява
 * сайтът с `TURNSTILE_SECRET_KEY` (виж `lib/telefon.ts`).
 */
export const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Името на полето, което джаджата сама добавя във формата. */
export const TURNSTILE_POLE = "cf-turnstile-response";

export const TURNSTILE_GRESHKA =
  "Проверката „не съм робот“ не мина. Опитай отново.";
