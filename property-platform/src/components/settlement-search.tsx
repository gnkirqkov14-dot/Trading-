"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type Settlement = {
  id: string;
  name: string;
  region: string;
  municipality: string | null;
  is_village: boolean;
};

export function settlementLabel(settlement: Settlement) {
  return `${settlement.is_village ? "с." : "гр."} ${settlement.name}`;
}

// Уточнението е нужно, защото 527 имена се срещат повече от веднъж в
// страната (напр. Банкя в Столична община и Банкя в община Трън) — само
// името не е достатъчно, за да познае човек кое населено място избира.
function settlementHint(settlement: Settlement) {
  const parts = [];
  if (settlement.municipality && settlement.municipality !== settlement.name) {
    parts.push(`общ. ${settlement.municipality}`);
  }
  parts.push(`обл. ${settlement.region}`);
  return parts.join(", ");
}

const RESULT_LIMIT = 12;

// z-index-ът трябва да бие Leaflet — неговите слоеве и контроли стигат до
// 1000, а на началната страница търсачката стои точно над картата (иначе
// полигоните на областите се рисуват върху падащия списък).
const DROPDOWN_CLASS =
  "absolute left-0 right-0 top-full z-[1100] mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg";

export function SettlementSearch({
  selected,
  onSelect,
  placeholder = "Търси град или село...",
  className = "",
}: {
  selected: Settlement | null;
  onSelect: (settlement: Settlement | null) => void;
  placeholder?: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  // Пази и за коя заявка са резултатите — така "зарежда се" и изчистването
  // при триене се изчисляват при рендер, вместо със setState в ефекта.
  const [found, setFound] = useState<{ query: string; items: Settlement[] }>({
    query: "",
    items: [],
  });
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const trimmedQuery = query.trim();
  const searchable = trimmedQuery.length >= 2;
  const results = searchable && found.query === trimmedQuery ? found.items : [];
  const loading = searchable && found.query !== trimmedQuery;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      const supabase = createClient();
      // Търсене по начало на името ("ва" -> Варна, Варвара...) — ползва
      // индекса cities_name_prefix_idx и отговаря на очакването на човека,
      // който пише първите букви.
      const { data } = await supabase
        .from("cities")
        .select("id, name, region, municipality, is_village")
        .ilike("name", `${trimmed}%`)
        .order("is_village")
        .order("name")
        .limit(RESULT_LIMIT);

      if (cancelled) return;
      setFound({ query: trimmed, items: (data ?? []) as Settlement[] });
      setHighlighted(0);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(settlement: Settlement) {
    onSelect(settlement);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[highlighted]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  if (selected) {
    return (
      <div
        className={`flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm ${className}`}
      >
        <span className="truncate">
          <span className="font-medium text-slate-900">
            {settlementLabel(selected)}
          </span>{" "}
          <span className="text-slate-500">{settlementHint(selected)}</span>
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="shrink-0 rounded-full px-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Изчисти избраното населено място"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-slate-900"
      />

      {open && searchable && (
        <ul
          id={listboxId}
          role="listbox"
          className={DROPDOWN_CLASS}
        >
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">Търси се...</li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">
              Няма намерено населено място
            </li>
          )}
          {results.map((settlement, index) => (
            <li key={settlement.id} role="option" aria-selected={index === highlighted}>
              <button
                type="button"
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(settlement)}
                className={`flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm ${
                  index === highlighted ? "bg-slate-100" : ""
                }`}
              >
                <span className="font-medium text-slate-900">
                  {settlementLabel(settlement)}
                </span>
                <span className="text-xs text-slate-500">
                  {settlementHint(settlement)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
