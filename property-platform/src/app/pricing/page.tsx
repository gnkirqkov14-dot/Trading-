import type { Metadata } from "next";
import {
  PLAN_ACTIVE_LISTING_LIMITS,
  PLAN_LABELS,
  PLAN_PRICES_BGN,
} from "@/lib/listing-labels";
import type { SubscriptionPlan } from "@/lib/types/database";

export const metadata: Metadata = { title: "Планове" };

const PLAN_ORDER: SubscriptionPlan[] = ["basic", "pro", "unlimited"];

const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  basic: ["До 3 активни обяви", "Съобщения от заинтересовани", "Статистика на прегледи"],
  pro: ["До 15 активни обяви", "Всичко от Basic", "Приоритет в резултатите"],
  unlimited: ["Неограничен брой обяви", "Всичко от Pro", "За агенции с много имоти"],
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <h1 className="text-center text-3xl font-bold text-slate-900">
        Планове за публикуване
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-center text-slate-600">
        Търсенето на имот е винаги безплатно. Плащаш само ако публикуваш
        обяви.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {PLAN_ORDER.map((plan) => (
          <div
            key={plan}
            className="flex flex-col rounded-2xl border border-slate-200 p-6"
          >
            <h2 className="text-lg font-semibold">{PLAN_LABELS[plan]}</h2>
            <p className="mt-2 text-3xl font-bold">
              {PLAN_PRICES_BGN[plan] === 0 ? (
                "Безплатно"
              ) : (
                <>
                  {PLAN_PRICES_BGN[plan]} лв.
                  <span className="text-sm font-normal text-slate-500">
                    /мес.
                  </span>
                </>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {PLAN_PRICES_BGN[plan] > 0 && "примерна цена — предстои потвърждение"}
            </p>

            <ul className="mt-6 flex flex-col gap-2 text-sm text-slate-700">
              {PLAN_FEATURES[plan].map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-6">
              {plan === "basic" ? (
                <p className="text-center text-sm text-slate-400">
                  Твой план по подразбиране
                </p>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-400"
                  title="Плащанията ще бъдат добавени скоро"
                >
                  Очаквайте скоро
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-10 max-w-xl text-center text-sm text-slate-400">
        Лимитът е за брой{" "}
        <strong>активни</strong> обяви едновременно (Basic:{" "}
        {PLAN_ACTIVE_LISTING_LIMITS.basic}, Pro: {PLAN_ACTIVE_LISTING_LIMITS.pro}
        ) — деактивирана или изтекла обява не се брои.
      </p>
    </div>
  );
}
