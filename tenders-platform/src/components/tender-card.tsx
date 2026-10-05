import Link from "next/link";
import { KindBadge, KindPrefix } from "@/components/kind-label";
import { divisionName } from "@/lib/eop/cpv";
import { regionName } from "@/lib/eop/regions";
import type { Tender } from "@/lib/eop/types";
import { deadlineLabel, formatDate, formatEur } from "@/lib/format";

const toneClass = {
  urgent: "bg-amber-100 text-amber-800",
  ok: "bg-emerald-100 text-emerald-800",
  muted: "bg-slate-100 text-slate-600",
};

export function TenderCard({ tender }: { tender: Tender }) {
  const deadline = deadlineLabel(tender.deadline_at);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-500">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <KindBadge text="Обществена поръчка" tone="tender" />
        <span className={`rounded-full px-2 py-0.5 font-medium ${toneClass[deadline.tone]}`}>
          {deadline.text}
        </span>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-700">
          {divisionName(tender.cpv_division)}
        </span>
        {tender.eu_funded ? (
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">Европейски средства</span>
        ) : null}
      </div>
      <h2 className="text-base font-semibold leading-snug text-slate-900">
        <Link href={`/tenders/${tender.id}`} className="hover:text-brand-600">
          <KindPrefix text="Обществена поръчка" />
          {tender.title}
        </Link>
      </h2>
      {tender.lot_title ? (
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">
          Позиция {tender.lot_number}: {tender.lot_title}
        </p>
      ) : null}
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="sr-only">Възложител</dt>
          <dd className="truncate">{tender.buyer_name}</dd>
        </div>
        <div>
          <dt className="sr-only">Област</dt>
          <dd>{regionName(tender.region_code)}</dd>
        </div>
        <div className="sm:text-right">
          <dt className="sr-only">Прогнозна стойност</dt>
          <dd className="font-semibold text-slate-900">{formatEur(tender.value_eur)}</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">Срок за оферти: {formatDate(tender.deadline_at)}</p>
    </article>
  );
}
