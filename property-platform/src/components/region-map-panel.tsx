"use client";

import { useState } from "react";
import { BulgariaMap, type MapCity } from "@/components/bulgaria-map";

/**
 * Картата вече не стои на началната страница — собственикът поиска тя да е
 * чиста. Тук е, свита зад бутон.
 *
 * Картата се **монтира чак при отваряне**, не се крие с CSS. Leaflet мери
 * контейнера си при инициализация и ако го направи в скрит елемент
 * (`display:none`, затворен `<details>`), излиза със сиво поле и се оправя
 * само след ръчен `invalidateSize()`. Свежото монтиране заобикаля целия
 * проблем.
 */
export function RegionMapPanel({ cities }: { cities: MapCity[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z" />
          <path d="M9 4v13M15 6.5v13" />
        </svg>
        {open ? "Скрий картата" : "Избери от картата"}
      </button>

      {open && (
        <div className="mt-4">
          <BulgariaMap cities={cities} />
        </div>
      )}
    </div>
  );
}
