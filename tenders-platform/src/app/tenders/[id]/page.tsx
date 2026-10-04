import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { divisionName } from "@/lib/eop/cpv";
import { regionName } from "@/lib/eop/regions";
import { deadlineLabel, formatDateTime, formatEur } from "@/lib/format";
import { officialUrl } from "@/lib/site";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const loadTender = cache(async (rawId: string) => {
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return getStore().getTender(id);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const tender = await loadTender((await params).id);
  if (!tender) return { title: "Няма такава поръчка" };
  const value = tender.value_eur ? `, ${formatEur(tender.value_eur)}` : "";
  return {
    title: `${tender.title}${value}`,
    description: `${tender.buyer_name}, ${regionName(tender.region_code)}. Срок за оферти: ${formatDateTime(tender.deadline_at)}.`,
    alternates: { canonical: `/tenders/${tender.id}` },
  };
}

export default async function TenderPage({ params }: { params: Promise<{ id: string }> }) {
  const tender = await loadTender((await params).id);
  if (!tender) notFound();

  const deadline = deadlineLabel(tender.deadline_at);
  const facts: [string, string][] = [
    ["Възложител", tender.buyer_name],
    ["Място", [tender.buyer_locality, regionName(tender.region_code)].filter(Boolean).join(", ")],
    ["Прогнозна стойност", formatEur(tender.value_eur)],
    ["Срок за оферти", formatDateTime(tender.deadline_at)],
    ["Бранш", divisionName(tender.cpv_division)],
    ["Код по CPV", [tender.cpv_code, tender.cpv_label].filter(Boolean).join(" · ") || "—"],
    ["Вид договор", tender.contract_type ?? "—"],
    ["Процедура", tender.procedure_type ?? tender.notice_type ?? "—"],
    ["Уникален номер (УНП)", tender.procurement_number ?? "—"],
    ["Европейско финансиране", tender.eu_funded ? tender.eu_program ?? "Да" : "Не"],
    ["Публикувана", formatDateTime(tender.published_at)],
  ];

  const similar = new URLSearchParams();
  if (tender.cpv_division) similar.set("category", tender.cpv_division);
  if (tender.region_code) similar.set("region", tender.region_code);

  return (
    <article className="space-y-6">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← Всички поръчки
      </Link>

      <header className="space-y-3">
        <p className="text-sm font-medium text-slate-500">
          {deadline.text}
          {tender.is_cancelled ? " · Прекратена" : ""}
        </p>
        <h1 className="text-2xl font-bold leading-tight text-slate-900">{tender.title}</h1>
        {tender.lot_title ? (
          <p className="text-slate-700">
            <strong>Обособена позиция {tender.lot_number}:</strong> {tender.lot_title}
          </p>
        ) : null}
      </header>

      <dl className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2">
        {facts.map(([label, value], i) => (
          <div
            key={label}
            className={`bg-white p-4 ${i === facts.length - 1 && facts.length % 2 === 1 ? "sm:col-span-2" : ""}`}
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {tender.description ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Описание</h2>
          <p className="whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
            {tender.description}
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <a
          href={officialUrl(tender.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Документите и подаването в ЦАИС ЕОП
        </a>
        <Link
          href={`/apply/tender/${tender.id}`}
          className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          Помощ за ЕЕДОП и офертата
        </Link>
        <Link
          href={`/alerts?${similar.toString()}`}
          className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
        >
          Искам подобни поръчки по имейл
        </Link>
      </div>

      <p className="text-xs text-slate-500">
        Офертите се подават само в ЦАИС ЕОП. Тук показваме обобщение от отворените данни на
        Агенцията по обществени поръчки; при разминаване важи официалната страница.
      </p>
    </article>
  );
}
