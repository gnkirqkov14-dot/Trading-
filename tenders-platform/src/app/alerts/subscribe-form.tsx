"use client";

import { useActionState } from "react";
import { CPV_OPTIONS } from "@/lib/eop/cpv";
import { REGION_OPTIONS } from "@/lib/eop/regions";
import { subscribe, type SubscribeState } from "./actions";

type Defaults = { q?: string; region?: string; category?: string; min?: string };

export function SubscribeForm({ defaults, enabled }: { defaults: Defaults; enabled: boolean }) {
  const [state, action, pending] = useActionState<SubscribeState, FormData>(subscribe, null);
  const field =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none";

  if (state?.ok) {
    return (
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-emerald-900">
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2">
      {!enabled ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2">
          Известията по имейл се включват скоро. Дотогава можете да търсите поръчки на сайта.
        </p>
      ) : null}
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Имейл</span>
        <input name="email" type="email" required className={field} placeholder="firma@example.bg" />
      </label>
      <label className="sm:col-span-2">
        <span className="mb-1 block text-xs font-medium text-slate-600">Ключови думи, по избор</span>
        <input name="q" defaultValue={defaults.q} className={field} placeholder="напр. асфалт, видеонаблюдение" />
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-600">Бранш</span>
        <select name="category" defaultValue={defaults.category ?? ""} className={field}>
          <option value="">Всички браншове</option>
          {CPV_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-600">Област</span>
        <select name="region" defaultValue={defaults.region ?? ""} className={field}>
          <option value="">Цялата страна</option>
          {REGION_OPTIONS.map((o) => (
            <option key={o.code} value={o.code}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-xs font-medium text-slate-600">Минимален бюджет, €</span>
        <input name="min" inputMode="numeric" defaultValue={defaults.min} className={field} />
      </label>
      {/* Капан за ботове — скрит от хората. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="flex items-start gap-2 text-sm text-slate-600 sm:col-span-2">
        <input type="checkbox" name="consent" className="mt-1" required />
        Съгласен съм да получавам писма с нови поръчки на този имейл. Ползваме го само за
        известията и можете да се отпишете с един клик от всяко писмо.
      </label>
      {state && !state.ok ? <p className="text-sm text-red-700 sm:col-span-2">{state.message}</p> : null}
      <div className="sm:col-span-2">
        <button
          disabled={pending || !enabled}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {pending ? "Изпращане…" : "Абонирай ме"}
        </button>
      </div>
    </form>
  );
}
