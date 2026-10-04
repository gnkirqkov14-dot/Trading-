/** Име и адрес на сайта — сменят се от Vercel, без промяна в кода. */
export const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "Нови поръчки";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

/** Официалната страница на поръчката в ЦАИС ЕОП. */
export function officialUrl(tenderId: number) {
  return `https://app.eop.bg/today/${tenderId}`;
}
