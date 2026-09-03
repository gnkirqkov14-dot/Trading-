"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DEAL_TYPE_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/listing-labels";

type City = { id: string; name: string };

export function ListingFilters({ cities }: { cities: City[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  const selectClass =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900";

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className={selectClass}
        value={searchParams.get("type") ?? ""}
        onChange={(e) => updateParam("type", e.target.value)}
      >
        <option value="">Наем и продажба</option>
        {Object.entries(DEAL_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={searchParams.get("propertyType") ?? ""}
        onChange={(e) => updateParam("propertyType", e.target.value)}
      >
        <option value="">Всички типове имот</option>
        {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        className={selectClass}
        value={searchParams.get("city") ?? ""}
        onChange={(e) => updateParam("city", e.target.value)}
      >
        <option value="">Всички градове</option>
        {cities.map((city) => (
          <option key={city.id} value={city.id}>
            {city.name}
          </option>
        ))}
      </select>
    </div>
  );
}
