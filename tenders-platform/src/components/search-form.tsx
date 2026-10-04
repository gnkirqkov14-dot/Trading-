import { CPV_OPTIONS } from "@/lib/eop/cpv";
import { REGION_OPTIONS } from "@/lib/eop/regions";
import type { TenderFilters } from "@/lib/eop/types";

/**
 * Обикновена GET форма — работи и без JavaScript, а всеки резултат има
 * собствен адрес, който може да се сподели или да се прочете от бот.
 */
export function SearchForm({ filters }: { filters: TenderFilters }) {
  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
  return (
    <form method="get" action="/" className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-6">
      <label className="col-span-2 sm:col-span-6">
        <span className="mb-1 block text-xs font-medium text-slate-600">Какво търсите</span>
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="напр. ремонт на улици, почистване, лекарства, софтуер"
          className={field}
        />
      </label>
      <label className="col-span-2 sm:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-600">Бранш</span>
        <select name="category" defaultValue={filters.category ?? ""} className={field}>
          <option value="">Всички браншове</option>
          {CPV_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 sm:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-600">Област</span>
        <select name="region" defaultValue={filters.region ?? ""} className={field}>
          <option value="">Цялата страна</option>
          {REGION_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Бюджет от, €</span>
        <input name="min" inputMode="numeric" defaultValue={filters.minValue ?? ""} className={field} />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Бюджет до, €</span>
        <input name="max" inputMode="numeric" defaultValue={filters.maxValue ?? ""} className={field} />
      </label>
      <label className="col-span-2 sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Подреди по</span>
        <select name="sort" defaultValue={filters.sort ?? "deadline"} className={field}>
          <option value="deadline">Най-близък срок</option>
          <option value="newest">Най-нови</option>
          <option value="value">Най-голям бюджет</option>
        </select>
      </label>
      <div className="col-span-2 flex flex-wrap items-center justify-between gap-3 sm:col-span-6">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={filters.openOnly === false} />
          Покажи и поръчките с изтекъл срок
        </label>
        <button className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Търси
        </button>
      </div>
    </form>
  );
}
