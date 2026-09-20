"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettlementSearch } from "@/components/settlement-search";

export type PopularCity = { id: string; name: string };

type DealType = "sale" | "rent";

// Най-търсените градове идват наготово от сървъра с истинските си id-та —
// чиповете са само пряк път към вече работещия филтър на /listings,
// няма отделна логика зад тях.
export function HeroSearch({ popular }: { popular: PopularCity[] }) {
  const router = useRouter();
  const [dealType, setDealType] = useState<DealType>("sale");

  function go(params: Record<string, string>) {
    const query = new URLSearchParams({ type: dealType, ...params });
    router.push(`/listings?${query}`);
  }

  return (
    <div>
      <div className="rounded-3xl border border-white/70 bg-white/75 p-2.5 shadow-[0_30px_60px_-30px_rgba(15,36,56,0.5)] backdrop-blur-xl sm:p-3">
        <div className="mb-2.5 inline-flex rounded-2xl bg-slate-100 p-1">
          {(
            [
              ["sale", "Продажби"],
              ["rent", "Наеми"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDealType(value)}
              aria-pressed={dealType === value}
              className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                dealType === value
                  ? "bg-white text-brand-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SettlementSearch
            className="flex-1"
            selected={null}
            placeholder="Град или село…"
            onSelect={(settlement) => {
              if (settlement) go({ city: settlement.id });
            }}
          />
          <button
            type="button"
            onClick={() => go({})}
            className="shrink-0 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-500 px-7 py-4 font-bold text-[#04231a] shadow-[0_14px_30px_-12px_rgba(43,185,140,0.85)] transition hover:brightness-105"
          >
            Търси
          </button>
        </div>
      </div>

      {popular.length > 0 && (
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
        <span>Популярни:</span>
        {popular.map((city) => (
          <button
            key={city.id}
            type="button"
            onClick={() => go({ city: city.id })}
            className="rounded-full border border-slate-200 bg-white/80 px-3.5 py-1.5 text-slate-600 transition hover:border-slate-300 hover:bg-white"
          >
            {city.name}
          </button>
        ))}
      </div>
      )}
    </div>
  );
}
