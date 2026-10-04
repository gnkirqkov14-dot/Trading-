import "server-only";

import { divisionName } from "@/lib/eop/cpv";
import { regionName } from "@/lib/eop/regions";
import type { Tender } from "@/lib/eop/types";
import { formatDate, formatEur } from "@/lib/format";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * Имейли през Resend с обикновен HTTP POST (без техния SDK), както в
 * property-platform/src/lib/email.ts. Без `RESEND_API_KEY` известията са
 * изключени: страницата за абониране казва това честно, вместо да
 * записва имейли, на които после нищо не идва.
 */
export const emailEnabled = Boolean(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? `${SITE_NAME} <onboarding@resend.dev>`;
// Само за тестове: подменя адреса на Resend с локален мок сървър.
const RESEND_URL = process.env.RESEND_API_URL ?? "https://api.resend.com/emails";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function send(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY липсва");
  const res = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

export async function sendConfirmationEmail(to: string, token: string) {
  const url = `${SITE_URL}/alerts/confirm?token=${encodeURIComponent(token)}`;
  await send(
    to,
    `Потвърдете известията от ${SITE_NAME}`,
    `<p>Здравейте,</p>
<p>Някой, вероятно вие, поиска известия за нови обществени поръчки на този имейл.</p>
<p><a href="${url}">Потвърждавам, искам известията</a></p>
<p>Ако не сте били вие, просто игнорирайте писмото и няма да получите нищо повече.</p>`,
  );
}

export async function sendDigestEmail(to: string, token: string, tenders: Tender[], more: number) {
  const unsubscribe = `${SITE_URL}/alerts/unsubscribe?token=${encodeURIComponent(token)}`;
  const items = tenders
    .map(
      (t) => `<li style="margin-bottom:14px">
<a href="${SITE_URL}/tenders/${t.id}"><strong>${esc(t.title)}</strong></a>${t.lot_title ? `<br>Позиция ${esc(t.lot_number ?? "")}: ${esc(t.lot_title.slice(0, 160))}` : ""}<br>
${esc(t.buyer_name)} · ${esc(regionName(t.region_code))} · ${esc(divisionName(t.cpv_division))}<br>
Бюджет: <strong>${esc(formatEur(t.value_eur))}</strong> · Срок: <strong>${esc(formatDate(t.deadline_at))}</strong>
</li>`,
    )
    .join("");
  await send(
    to,
    `${tenders.length + more} нови поръчки за вас`,
    `<p>Нови обществени поръчки по вашите условия:</p>
<ul style="padding-left:18px">${items}</ul>
${more > 0 ? `<p>И още ${more}. <a href="${SITE_URL}">Вижте всички на сайта.</a></p>` : ""}
<p style="color:#64748b;font-size:12px">Получавате това писмо, защото се абонирахте в ${esc(SITE_NAME)}. <a href="${unsubscribe}">Отписване</a></p>`,
  );
}
