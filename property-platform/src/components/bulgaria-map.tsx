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

      function showCityMarkers() {
        markersLayer.clearLayers();
        cities.forEach((city) => {
          const marker = L.circleMarker([city.lat, city.lng], {
            pane: "markers",
            radius: 6,
            color: "#ffffff",
            weight: 2,
            fillColor: "#059669",
            fillOpacity: 1,
          }).addTo(markersLayer);
          marker.bindTooltip(city.name, {
            permanent: true,
            direction: "bottom",
            offset: [0, 4],
            className: "map-label",
          });
          marker.on("click", () => {
            const hasNeighborhoods = neighborhoods.some(
              (n) => n.city_id === city.id,
            );
            if (hasNeighborhoods) {
              router.push(`/map/${city.id}`);
            } else {
              router.push(`/listings?city=${city.id}`);
            }
          });
        });
      }

      showCityMarkers();
      // expose for the "back" button below without re-running the effect
      (map as unknown as { __showCityMarkers?: () => void }).__showCityMarkers =
        showCityMarkers;

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
            setSelectedRegion(feature.properties?.name ?? null);
            showCityMarkers();
          });
          path.bindTooltip(feature.properties?.name ?? "", {
            sticky: true,
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

  function resetView() {
    const map = mapRef.current;
    if (!map) return;
    map.setView(BULGARIA_CENTER, BULGARIA_ZOOM, { animate: false });
    setSelectedRegion(null);
    (
      map as unknown as { __showCityMarkers?: () => void }
    ).__showCityMarkers?.();
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
    </div>
  );
}
