"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type L from "leaflet";
import type { Map as LeafletMap, GeoJSON as LeafletGeoJSON } from "leaflet";

export type MapCity = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
};

const BULGARIA_CENTER: [number, number] = [42.7339, 25.4858];
const BULGARIA_ZOOM = 7;

export function BulgariaMap({ cities }: { cities: MapCity[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const provincesRef = useRef<LeafletGeoJSON | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: BULGARIA_CENTER,
        zoom: BULGARIA_ZOOM,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      const res = await fetch("/data/bulgaria-provinces.geojson");
      const geojson = await res.json();
      if (cancelled) return;

      const provinces = L.geoJSON(geojson, {
        style: {
          color: "#0f172a",
          weight: 1,
          fillColor: "#64748b",
          fillOpacity: 0.15,
        },
        onEachFeature: (feature, layer) => {
          const path = layer as L.Polygon;
          path.on("mouseover", () => {
            path.setStyle({ fillOpacity: 0.35 });
          });
          path.on("mouseout", () => {
            path.setStyle({ fillOpacity: 0.15 });
          });
          path.on("click", () => {
            map.fitBounds(path.getBounds(), { padding: [20, 20] });
            setSelectedRegion(feature.properties?.name ?? null);
          });
          path.bindTooltip(feature.properties?.name ?? "", {
            sticky: true,
          });
        },
      }).addTo(map);
      provincesRef.current = provinces;

      cities.forEach((city) => {
        const marker = L.circleMarker([city.lat, city.lng], {
          radius: 6,
          color: "#ffffff",
          weight: 2,
          fillColor: "#0f172a",
          fillOpacity: 1,
        }).addTo(map);
        marker.bindTooltip(city.name);
        marker.on("click", () => {
          router.push(`/listings?city=${city.id}`);
        });
      });
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    map.setView(BULGARIA_CENTER, BULGARIA_ZOOM);
    setSelectedRegion(null);
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
        <span>
          {selectedRegion
            ? `Област: ${selectedRegion}`
            : "Кликни на област, за да приближиш"}
        </span>
        {selectedRegion && (
          <button
            type="button"
            onClick={resetView}
            className="font-medium text-slate-900 underline"
          >
            Цяла България
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200"
      />
    </div>
  );
}
