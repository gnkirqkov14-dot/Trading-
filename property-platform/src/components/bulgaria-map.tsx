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
  const [selectedCity, setSelectedCity] = useState<MapCity | null>(null);
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

      // Dedicated pane so city/neighborhood markers always render (and
      // hit-test for clicks) above the province polygons, regardless of
      // add order.
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
            fillColor: "#0f172a",
            fillOpacity: 1,
          }).addTo(markersLayer);
          marker.bindTooltip(city.name);
          marker.on("click", () => {
            const cityNeighborhoods = neighborhoods.filter(
              (n) => n.city_id === city.id,
            );
            if (cityNeighborhoods.length === 0) {
              router.push(`/listings?city=${city.id}`);
              return;
            }
            setSelectedCity(city);
            const bounds = L.latLngBounds(
              cityNeighborhoods.map((n) => [n.lat, n.lng] as [number, number]),
            );
            map.fitBounds(bounds, {
              padding: [40, 40],
              maxZoom: 15,
              animate: false,
            });
            showNeighborhoodMarkers(city, cityNeighborhoods);
          });
        });
      }

      function showNeighborhoodMarkers(
        city: MapCity,
        cityNeighborhoods: MapNeighborhood[],
      ) {
        markersLayer.clearLayers();
        cityNeighborhoods.forEach((n) => {
          const marker = L.circleMarker([n.lat, n.lng], {
            pane: "markers",
            radius: 6,
            color: "#ffffff",
            weight: 2,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }).addTo(markersLayer);
          marker.bindTooltip(n.name);
          marker.on("click", () => {
            router.push(`/listings?city=${city.id}&neighborhood=${n.id}`);
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
            map.fitBounds(path.getBounds(), {
              padding: [20, 20],
              animate: false,
            });
            setSelectedRegion(feature.properties?.name ?? null);
            setSelectedCity(null);
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
    setSelectedCity(null);
    (
      map as unknown as { __showCityMarkers?: () => void }
    ).__showCityMarkers?.();
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          {selectedCity
            ? `Град: ${selectedCity.name} — избери квартал`
            : selectedRegion
              ? `Област: ${selectedRegion}`
              : "Кликни на област, за да приближиш"}
        </span>
        <span className="flex items-center gap-3">
          {selectedCity && (
            <a
              href={`/listings?city=${selectedCity.id}`}
              className="font-medium text-slate-900 underline"
            >
              Всички обяви в {selectedCity.name}
            </a>
          )}
          {(selectedRegion || selectedCity) && (
            <button
              type="button"
              onClick={resetView}
              className="font-medium text-slate-900 underline"
            >
              Цяла България
            </button>
          )}
        </span>
      </div>
      <div
        ref={containerRef}
        className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200"
      />
    </div>
  );
}
