import { headers } from "next/headers";

/**
 * Приблизителният град на посетителя по IP, както го дава Vercel
 * (`x-vercel-ip-city`). Пример: „Sofia, BG“. Локално и без Vercel няма
 * заглавки и връща празно. Самият IP адрес не се пази никъде.
 */
export async function gradPoIp(): Promise<string> {
  const h = await headers();
  const grad = h.get("x-vercel-ip-city");
  const darzhava = h.get("x-vercel-ip-country");
  let ime = "";
  try {
    ime = grad ? decodeURIComponent(grad) : "";
  } catch {
    ime = grad ?? "";
  }
  return [ime, darzhava].filter(Boolean).join(", ").slice(0, 80);
}
