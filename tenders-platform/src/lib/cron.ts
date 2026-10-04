/**
 * Vercel Cron праща `Authorization: Bearer <CRON_SECRET>`. Без зададен
 * CRON_SECRET проверката е изключена (за локално тестване); в production
 * тайната трябва да е зададена — виж docs/РЪЧНИ-СТЪПКИ.md.
 */
export function cronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
