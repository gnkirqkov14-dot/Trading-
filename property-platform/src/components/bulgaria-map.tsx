"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type L from "leaflet";
import type {
  Map as LeafletMap,
  GeoJSON as LeafletGeoJSON,
  LayerGroup,
} from "leaflet";

export type MapCity = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
};

export type MapNeighborhood = {
  id: string;
  city_id: string;
  name: string;
  lat: number;
  lng: number;
};

const BULGARIA_CENTER: [number, number] = [42.7339, 25.4858];
const BULGARIA_ZOOM = 7;

export function BulgariaMap({
  cities,
  neighborhoods,
}: {
  cities: MapCity[];
  neighborhoods: MapNeighborhood[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const provincesRef = useRef<LeafletGeoJSON | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const router = useRouter();

  function goToCity(city: MapCity) {
    const hasNeighborhoods = neighborhoods.some((n) => n.city_id === city.id);
    if (hasNeighborhoods) {
      router.push(`/map/${city.id}`);
    } else {
      router.push(`/listings?city=${city.id}`);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: BULGARIA_CENTER,
        zoom: BULGARIA_ZOOM,
        scrollWheelZoom: false,
        zoomSnap: 0.25,
      });
      mapRef.current = map;

      // Без tile слой нарочно — плосък, оцветен диаграмен вид вместо
      // реалистична улична карта.

      // Dedicated pane so city markers always render (and hit-test for
      // clicks) above the province polygons, regardless of add order.
      const markersPane = map.createPane("markers");
      markersPane.style.zIndex = "450";

      const markersLayer = L.layerGroup().addTo(map);
      markersLayerRef.current = markersLayer;

      function showCityMarkers(region: string | null) {
        markersLayer.clearLayers();
        // At the whole-country zoom level we show no city dots at all —
        // only the region has to be picked first (like imot.bg). Showing
        // every city's dot here let people tap a city directly and jump
        // straight to it, completely skipping the "pick a region, see the
        // list of its cities" step — which made that new list look like it
        // never appeared, since this dot-tap path never reaches it.
        if (!region) return;
        cities
          .filter((city) => city.region === region)
          .forEach((city) => {
            // A tiny dot + a separate non-interactive label left a dead
            // zone where the (visually obvious) name wasn't actually
            // clickable — on touch screens people tap the text, not the
            // 6px dot above it. A single divIcon "chip" makes the whole
            // name+dot one generous tap target.
            const icon = L.divIcon({
              className: "city-chip-icon",
              html: `<span class="city-chip"><span class="city-chip-dot"></span>${city.name}</span>`,
              iconSize: [1, 1],
              iconAnchor: [0, 0],
            });
            const marker = L.marker([city.lat, city.lng], {
              pane: "markers",
              icon,
            }).addTo(markersLayer);
            marker.on("click", () => goToCity(city));
          });
      }

      showCityMarkers(null);
      // expose for the "back" button below without re-running the effect
      (
        map as unknown as {
          __showCityMarkers?: (region: string | null) => void;
        }
      ).__showCityMarkers = showCityMarkers;

      const res = await fetch("/data/bulgaria-provinces.geojson");
      const geojson = await res.json();
      if (cancelled) return;

      const provinces = L.geoJSON(geojson, {
        style: {
          color: "#475569",
          weight: 1.5,
          fillColor: "#e2e8f0",
          fillOpacity: 1,
        },
        onEachFeature: (feature, layer) => {
          const path = layer as L.Polygon;
          path.on("mouseover", () => {
            path.setStyle({ fillColor: "#a7f3d0" });
          });
          path.on("mouseout", () => {
            path.setStyle({ fillColor: "#e2e8f0" });
          });
          path.on("click", () => {
            map.fitBounds(path.getBounds(), {
              padding: [20, 20],
              animate: false,
            });
            const regionName = feature.properties?.name ?? null;
            setSelectedRegion(regionName);
            showCityMarkers(regionName);
          });
          path.bindTooltip(feature.properties?.name ?? "", {
            permanent: true,
            direction: "center",
            className: "map-label",
          });
        },
      }).addTo(map);
      provincesRef.current = provinces;
    }

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const citiesInRegion = selectedRegion
    ? cities.filter((c) => c.region === selectedRegion)
    : [];

  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    map.setView(BULGARIA_CENTER, BULGARIA_ZOOM, { animate: false });
    setSelectedRegion(null);
    (
      map as unknown as {
        __showCityMarkers?: (region: string | null) => void;
      }
    ).__showCityMarkers?.(null);
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {selectedRegion
            ? `Област: ${selectedRegion} — избери град`
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
        className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
      />
      {citiesInRegion.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {citiesInRegion.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => goToCity(city)}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-emerald-600 hover:text-emerald-700"
            >
              {city.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
