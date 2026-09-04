// Плоски HTTP заявки към Resend вместо да добавяме техния SDK като
// зависимост — API-то е тривиално (един POST). Без RESEND_API_KEY
// функцията тихо не прави нищо (напомнянето остава само в сайта, виж
// components/my-listings.tsx) — това позволява cron job-а да работи
// безпроблемно преди собственикът на проекта да си направи Resend акаунт.

export type ListingReminderRow = {
  listing_id: string;
  owner_email: string | null;
  owner_name: string | null;
  listing_title: string;
  stage: number;
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://property-platform-five.vercel.app";

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "Имоти без посредници <onboarding@resend.dev>";

function subjectFor(row: ListingReminderRow) {
  if (row.stage === 1) return `Все още ли е активна обявата "${row.listing_title}"?`;
  if (row.stage === 2) return `Последно напомняне за обявата "${row.listing_title}"`;
  return `Обявата "${row.listing_title}" беше архивирана`;
}

function bodyFor(row: ListingReminderRow) {
  const dashboardUrl = `${SITE_URL}/dashboard`;
  const greeting = row.owner_name ? `Здравей, ${row.owner_name}` : "Здравей";

  if (row.stage === 1) {
    return `<p>${greeting},</p>
<p>Обявата "<strong>${row.listing_title}</strong>" е публикувана преди седмица без потвърждение. Ако вече си продал/дал под наем имота, свали обявата от <a href="${dashboardUrl}">твоя профил</a>. Ако е все още активна, просто натисни „Обявата е още активна“ оттам.</p>`;
  }
  if (row.stage === 2) {
    return `<p>${greeting},</p>
<p>Все още не си потвърдил/а обявата "<strong>${row.listing_title}</strong>" — вече е отбелязана като неактуална в резултатите от търсене. Ако не потвърдиш до 7 дни, тя ще бъде архивирана автоматично. Провери от <a href="${dashboardUrl}">твоя профил</a>.</p>`;
  }
  return `<p>${greeting},</p>
<p>Обявата "<strong>${row.listing_title}</strong>" беше архивирана автоматично, защото не беше потвърдена в продължение на 3 седмици. Тя вече не се вижда публично. Можеш да я активираш отново по всяко време от <a href="${dashboardUrl}">твоя профил</a>.</p>`;
}

export async function sendListingReminderEmail(row: ListingReminderRow) {
  if (!process.env.RESEND_API_KEY || !row.owner_email) return;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: row.owner_email,
      subject: subjectFor(row),
      html: bodyFor(row),
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  }
}
