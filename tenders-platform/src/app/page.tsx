import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { TenderCard } from "@/components/tender-card";
import { filtersFromParams } from "@/lib/filters";
import { numParam } from "@/lib/format";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = Record<string, string | string[] | undefined>;

function withParams(params: SearchParams, patch: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) {
    if (typeof v === "string" && v !== "") qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const page = Math.max(1, Math.floor(numParam(params.page) ?? 1));

  const store = getStore();
  const [{ rows, total }, lastDate] = await Promise.all([
    store.searchTenders({ ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    store.lastImportedDate().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const alertParams = withParams({}, {
    q: filters.q,
    region: filters.region,
    category: filters.category,
    min: filters.minValue !== undefined ? String(filters.minValue) : undefined,
  });

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Обществените поръчки в България, всяка сутрин
        </h1>
        <p className="max-w-2xl text-slate-600">
          Намерете поръчките за вашия бранш и област, преди да изтече срокът. Абонирайте се и
          новите поръчки идват сами на имейла ви.
        </p>
      </section>

      <Link
        href="/advisor"
        className="flex flex-col gap-2 rounded-2xl border border-brand-100 bg-brand-50 p-5 transition hover:border-brand-500 sm:flex-row sm:items-center sm:justify-between"
      >
        <span>
          <span className="block font-semibold text-slate-900">
            Не знаете какво да търсите? Попитайте съветника.
          </span>
          <span className="block text-sm text-slate-600">
            Опишете с думи какво работи фирмата ви и ще ви покажем поръчките, в които можете да
            участвате, и защо.
          </span>
        </span>
        <span className="whitespace-nowrap rounded-lg bg-brand-600 px-4 py-2 text-center text-sm font-semibold text-white">
          Опиши фирмата си →
        </span>
      </Link>

      <SearchForm filters={filters} />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          <strong className="text-slate-900">{total.toLocaleString("bg-BG")}</strong>{" "}
          {filters.openOnly === false ? "поръчки" : "поръчки, по които още може да се кандидатства"}
          {lastDate ? ` · данни до ${lastDate.split("-").reverse().join(".")}` : ""}
        </p>
        <Link href={`/alerts${alertParams}`} className="font-medium text-brand-600 hover:underline">
          Получавайте тези поръчки по имейл →
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Няма поръчки по тези условия. Опитайте с по-малко филтри.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((t) => (
            <TenderCard key={t.id} tender={t} />
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav className="flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link className="rounded-lg border bg-white px-3 py-2" href={`/${withParams(params, { page: String(page - 1) })}`}>
              ← Предишни
            </Link>
          ) : null}
          <span className="text-slate-500">
            Страница {page} от {pages}
          </span>
          {page < pages ? (
            <Link className="rounded-lg border bg-white px-3 py-2" href={`/${withParams(params, { page: String(page + 1) })}`}>
              Следващи →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
