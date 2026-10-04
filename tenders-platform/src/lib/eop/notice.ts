import { decodeEntities, htmlToText } from "@/lib/grants/isun";

/**
 * Официалното обявление на поръчка от ЦАИС ЕОП — точните условия:
 * основания за отстраняване, критерии за подбор, гаранции, срокове.
 * По него се попълва ЕЕДОП, затова помощникът за кандидатстване работи
 * само с този текст (и цитира от него).
 *
 * ЦАИС ЕОП няма документирано API. Публичната страница на поръчката
 * (app.eop.bg/today/{id}) вика `GetPublishedTenderDetails` на
 * service.eop.bg — той работи без вход и връща HTML на всяко публикувано
 * обявление (`TenderPublicationDetails[].HtmlPreview`). Документацията
 * (образци, спецификации) иска вход — нея не я теглим.
 * Проверено на 04.10.2026.
 */

const SERVICE = "https://service.eop.bg/NX1Service.svc";

export type Notice = {
  tenderId: number;
  title: string;
  buyer: string;
  /** Текстът на всички публикувани обявления (основно + изменения), подред. */
  text: string;
  deadline: string | null;
  officialUrl: string;
};

function wcfDate(v: unknown): string | null {
  const m = typeof v === "string" ? v.match(/\/Date\((\d+)/) : null;
  return m ? new Date(Number(m[1])).toISOString() : null;
}

export async function fetchNotice(tenderId: number, timeoutMs = 30_000): Promise<Notice> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let data: Record<string, unknown>;
  try {
    const res = await fetch(`${SERVICE}/GetPublishedTenderDetails`, {
      method: "POST",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Origin: "https://app.eop.bg",
        Referer: "https://app.eop.bg/",
      },
      body: JSON.stringify({ tenderId, ianaTimeZone: "Europe/Sofia" }),
    });
    if (!res.ok) throw new Error(`ЦАИС ЕОП: ${res.status} за поръчка ${tenderId}`);
    data = (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }

  const pubs = Array.isArray(data.TenderPublicationDetails)
    ? (data.TenderPublicationDetails as { HtmlPreview?: string }[])
    : [];
  const text = pubs
    .map((p) => (p.HtmlPreview ? htmlToText(p.HtmlPreview) : ""))
    .filter(Boolean)
    .join("\n\n— — —\n\n");
  if (!text) throw new Error(`ЦАИС ЕОП: няма публикувано обявление за поръчка ${tenderId}`);

  return {
    tenderId,
    title: decodeEntities(String(data.TenderName ?? "")),
    buyer: decodeEntities(String(data.OrganizationName ?? "")),
    text,
    deadline: wcfDate(data.OfferPhaseEndDate),
    officialUrl: `https://app.eop.bg/today/${tenderId}`,
  };
}
