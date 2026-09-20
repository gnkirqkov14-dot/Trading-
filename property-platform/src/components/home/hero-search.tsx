"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SettlementSearch } from "@/components/settlement-search";

export type PopularCity = { id: string; name: string };

type DealType = "sale" | "rent";

/**
 * Две облекла на една и съща търсачка:
 * - `glass` — полупрозрачна карта върху снимката в скрол сцената
 *   (широк екран);
 * - `solid` — плътно бяла карта на телефон, където търсачката е
 *   най-важното нещо на екрана и трябва да се чете без усилие върху
 *   каквато и да е снимка отдолу.
 */
type Variant = "glass" | "solid";

// Най-търсените градове идват наготово от сървъра с истинските си id-та —
// чиповете са само пряк път към вече работещия филтър на /listings,
// няма отделна логика зад тях.
export function HeroSearch({
  popular,
  variant = "glass",
}: {
  popular: PopularCity[];
  variant?: Variant;
}) {
  const router = useRouter();
  const [dealType, setDealType] = useState<DealType>("sale");
  const solid = variant === "solid";

  function go(params: Record<string, string>) {
    const query = new URLSearchParams({ type: dealType, ...params });
    router.push(`/listings?${query}`);
  }

  return (
    <div>
      <div
        className={
          solid
            ? "rounded-3xl border border-slate-200 bg-white p-3.5 shadow-[0_24px_46px_-26px_rgba(15,36,56,0.45)]"
            : "rounded-3xl border border-white/70 bg-white/75 p-2.5 shadow-[0_30px_60px_-30px_rgba(15,36,56,0.5)] backdrop-blur-xl sm:p-3"
        }
      >
        <div
          className={
            solid
              ? "grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1"
              : "mb-2.5 inline-flex rounded-2xl bg-slate-100 p-1"
          }
        >
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
              className={`rounded-xl text-sm font-bold transition ${
                solid ? "py-2.5" : "px-4 py-2"
              } ${
                dealType === value
                  ? "bg-white text-brand-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={
            solid
              ? "mt-2.5 flex flex-col gap-2.5"
              : "flex flex-col gap-2 sm:flex-row sm:items-center"
          }
        >
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
            className={`shrink-0 rounded-2xl bg-gradient-to-br from-accent-400 to-accent-500 font-bold text-[#04231a] shadow-[0_14px_30px_-12px_rgba(43,185,140,0.85)] transition hover:brightness-105 ${
              solid ? "w-full py-4 text-[1.02rem]" : "px-7 py-4"
            }`}
          >
            {solid ? "Търси имот" : "Търси"}
          </button>
        </div>
      </div>

      {popular.length > 0 &&
        (solid ? (
          // На телефон чиповете се плъзгат настрани вместо да се редят
          // на два реда и да бутат надолу всичко под тях.
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <span className="shrink-0 self-center text-[0.72rem] font-extrabold uppercase tracking-[0.12em] text-slate-400">
              Често:
            </span>
            {popular.map((city) => (
              <button
                key={city.id}
                type="button"
                onClick={() => go({ city: city.id })}
                className="shrink-0 rounded-full bg-slate-100 px-3.5 py-2 text-sm font-semibold text-brand-600"
              >
                {city.name}
              </button>
            ))}
          </div>
        ) : (
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
        ))}
    </div>
  );
}
