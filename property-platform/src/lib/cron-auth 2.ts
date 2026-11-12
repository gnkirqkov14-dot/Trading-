import { timingSafeEqual } from "node:crypto";

/**
 * Пази дневните задачи в /api/cron. Vercel праща CRON_SECRET сам като
 * `Authorization: Bearer ...`. Ако ключът липсва в настройките, задачата
 * отказва на всички, вместо да се отвори за всеки отвън.
 *
 * Връща отговор с отказ или null, когато заявката е наша.
 */
export function otkazZaCron(
  request: Request,
  secret: string | undefined = process.env.CRON_SECRET,
): Response | null {
  if (!secret) {
    console.error("CRON_SECRET липсва: дневните задачи са спрени.");
    return Response.json(
      { ok: false, error: "CRON_SECRET is not set" },
      { status: 500 },
    );
  }
  const poluchen = Buffer.from(request.headers.get("authorization") ?? "");
  const ochakvan = Buffer.from(`Bearer ${secret}`);
  if (
    poluchen.length !== ochakvan.length ||
    !timingSafeEqual(poluchen, ochakvan)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}
