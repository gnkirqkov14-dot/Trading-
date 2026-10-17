"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

/**
 * Къде се намира имотът — пинче върху улична карта.
 *
 * Защо изобщо: на сграда в строеж още не ѝ е даден административен адрес;
 * номерът се издава към Акт 16. Затова и самите строители сочат обектите
 * си с карта, а не с улица и номер. Координатите вършат същата работа —
 * купувачът вижда точното място.
 *
 * Картата на страницата с градовете (`bulgaria-map.tsx`) нарочно е без
 * плочки — тя е диаграма на областите. Тази е обратното: истинска улична
 * карта, защото въпросът ѝ е „коя е сградата“.
 */
export function ListingMap({
  lat,
  lng,
  label,
}: {
  lat: number;
  lng: number;
  label: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [lat, lng],
        zoom: 17,
        // Колелцето нарочно не приближава: иначе превъртането на
        // страницата спира в картата и човек не може да продължи надолу.
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      // Собствено пинче, а не стандартното на Leaflet: неговото сочи към
      // png файл, който при сглобяване се губи и остава счупена картинка.
      const icon = L.divIcon({
        className: "listing-pin-icon",
        html: '<span class="listing-pin"></span>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([lat, lng], { icon }).addTo(map).bindTooltip(label);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, label]);

  return (
    <div className="mt-8">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Къде е имотът</h2>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-slate-900 underline underline-offset-2"
        >
          Отвори в Google Карти
        </a>
      </div>
      <div
        ref={containerRef}
        className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
      />
    </div>
  );
}
