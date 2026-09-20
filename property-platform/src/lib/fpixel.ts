/**
 * Meta (Facebook) Pixel — тънка обвивка около `window.fbq`.
 *
 * Пикселът се зарежда от `components/meta-pixel.tsx`. Тук стоят само
 * помощните функции, за да не се пише `window.fbq` из целия код и да
 * има едно място, което пази от „скриптът още не е дошъл".
 *
 * ⚠️ **Никога не пращай лични данни през тези функции** — имейл,
 * телефон, име, ЕГН, точен адрес. Meta ги приема, но това е предаване
 * на лични данни на трета страна и излиза извън всичко, което сме
 * казали на потребителите. Пращаме само id на обява, град, цена, тип
 * сделка.
 */
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Стандартно или персонализирано събитие. Тихо не прави нищо без пиксел. */
export function pixelEvent(
  name: string,
  params: Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  window.fbq?.("track", name, params);
}

/** Разглеждане на страница — праща се при всяка смяна на маршрута. */
export function pixelPageView() {
  pixelEvent("PageView");
}
