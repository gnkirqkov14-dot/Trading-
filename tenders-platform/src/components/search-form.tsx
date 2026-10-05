import Link from "next/link";
import { CPV_OPTIONS } from "@/lib/eop/cpv";
import { REGION_OPTIONS } from "@/lib/eop/regions";
import { BUYER_TYPES, CONTRACT_KINDS, type TenderFilters } from "@/lib/eop/types";
import { MIN_DAYS, NEW_DAYS } from "@/lib/filters";

/**
 * Обикновена GET форма — работи и без JavaScript, а всеки резултат има
 * собствен адрес, който може да се сподели или да се прочете от бот.
 * Всички филтри са в базата — без AI, безплатни.
 */
export function SearchForm({ filters }: { filters: TenderFilters }) {
  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";
  return (
    <form method="get" action="/" aria-label="Търсене на поръчки" className="grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-6">
      <label className="col-span-2 sm:col-span-6">
        <span className="mb-1 block text-xs font-medium text-slate-600">Какво търсите</span>
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="напр. ремонт на улици, почистване, лекарства, софтуер"
          className={field}
        />
      </label>
      <label className="col-span-2 sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Вид поръчка</span>
        <select name="kind" defaultValue={filters.kind ?? ""} className={field}>
          <option value="">Всички видове</option>
          {CONTRACT_KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 sm:col-span-2">
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
      <label className="col-span-2 sm:col-span-2">
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
      <label className="col-span-2 sm:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-600">Възложител</span>
        <input
          name="buyer"
          defaultValue={filters.buyer ?? ""}
          placeholder="напр. община Варна, МБАЛ, университет"
          className={field}
        />
      </label>
      <label className="col-span-2 sm:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-600">Вид възложител</span>
        <select name="btype" defaultValue={filters.buyerType ?? ""} className={field}>
          <option value="">Всички възложители</option>
          {Object.entries(BUYER_TYPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
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
      <label className="col-span-2 sm:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-600">Време до срока за оферти</span>
        <select name="days" defaultValue={filters.minDays ?? ""} className={field}>
          <option value="">Без значение</option>
          {MIN_DAYS.map((d) => (
            <option key={d} value={d}>
              Поне {d} дни за подготовка
            </option>
          ))}
        </select>
      </label>
      <label className="col-span-2 sm:col-span-3">
        <span className="mb-1 block text-xs font-medium text-slate-600">Публикувани</span>
        <select name="new" defaultValue={filters.newDays ?? ""} className={field}>
          <option value="">Без значение</option>
          {NEW_DAYS.map((d) => (
            <option key={d} value={d}>
              {d === 1 ? "През последния ден" : `През последните ${d} дни`}
            </option>
          ))}
        </select>
      </label>
      <div className="col-span-2 space-y-2 sm:col-span-6">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="eu" value="1" defaultChecked={filters.euOnly === true} />
          Само поръчки с европейско финансиране
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="small" value="1" defaultChecked={filters.smallOnly === true} />
          Само събиране на оферти с обява (поръчки с по-малка стойност)
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={filters.openOnly === false} />
          Покажи и поръчките с изтекъл срок
        </label>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-4 sm:col-span-6">
        <Link href="/" className="text-sm text-brand-700 underline">
          Изчисти филтрите
        </Link>
        <button className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Търси
        </button>
      </div>
    </form>
  );
}
