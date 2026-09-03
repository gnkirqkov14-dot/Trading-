"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/listing-labels";

type City = { id: string; name: string };
type Neighborhood = { id: string; city_id: string; name: string };

const AMENITY_FIELDS = [
  { key: "parking", label: "Паркинг" },
  { key: "elevator", label: "Асансьор" },
  { key: "terrace", label: "Тераса" },
  { key: "furnished", label: "Обзаведен" },
] as const;

export function ListingFilters({
  cities,
  neighborhoods,
}: {
  cities: City[];
  neighborhoods: Neighborhood[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedCity = searchParams.get("city") ?? "";
  const filteredNeighborhoods = useMemo(
    () => neighborhoods.filter((n) => n.city_id === selectedCity),
    [neighborhoods, selectedCity],
  );

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const inputClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <select
          className={inputClass}
          value={searchParams.get("type") ?? ""}
          onChange={(e) => updateParams({ type: e.target.value })}
        >
          <option value="">Наем и продажба</option>
          {Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={searchParams.get("propertyType") ?? ""}
          onChange={(e) => updateParams({ propertyType: e.target.value })}
        >
          <option value="">Всички типове имот</option>
          {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={selectedCity}
          onChange={(e) =>
            updateParams({ city: e.target.value, neighborhood: "" })
          }
        >
          <option value="">Всички градове</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={searchParams.get("neighborhood") ?? ""}
          onChange={(e) => updateParams({ neighborhood: e.target.value })}
          disabled={!selectedCity}
        >
          <option value="">Всички квартали</option>
          {filteredNeighborhoods.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => updateParams({ sort: e.target.value })}
        >
          <option value="newest">Най-нови</option>
          <option value="price_asc">Цена: ниска към висока</option>
          <option value="price_desc">Цена: висока към ниска</option>
        </select>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Цена от</label>
          <input
            type="number"
            min="0"
            className={`${inputClass} w-28`}
            defaultValue={searchParams.get("priceMin") ?? ""}
            onBlur={(e) => updateParams({ priceMin: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Цена до</label>
          <input
            type="number"
            min="0"
            className={`${inputClass} w-28`}
            defaultValue={searchParams.get("priceMax") ?? ""}
            onBlur={(e) => updateParams({ priceMax: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Кв.м от</label>
          <input
            type="number"
            min="0"
            className={`${inputClass} w-24`}
            defaultValue={searchParams.get("areaMin") ?? ""}
            onBlur={(e) => updateParams({ areaMin: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Кв.м до</label>
          <input
            type="number"
            min="0"
            className={`${inputClass} w-24`}
            defaultValue={searchParams.get("areaMax") ?? ""}
            onBlur={(e) => updateParams({ areaMax: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Стаи</label>
          <select
            className={inputClass}
            value={searchParams.get("rooms") ?? ""}
            onChange={(e) => updateParams({ rooms: e.target.value })}
          >
            <option value="">Всички</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4+">4+</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Етаж</label>
          <input
            type="number"
            className={`${inputClass} w-20`}
            defaultValue={searchParams.get("floor") ?? ""}
            onBlur={(e) => updateParams({ floor: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {AMENITY_FIELDS.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              checked={searchParams.get(key) === "1"}
              onChange={(e) =>
                updateParams({ [key]: e.target.checked ? "1" : "" })
              }
              className="h-4 w-4"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
