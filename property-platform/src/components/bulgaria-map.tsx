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

// Нямаме реални полигонни граници на кварталите (не открихме свободно
// лицензиран източник — виж CLAUDE.md), затова изграждаме приблизителни
// "райони" чрез Voronoi диаграма от координатите, които вече имаме за
// всеки квартал: всяка точка получава клетка от равнината, най-близка до
// нея — визуално прилича на разделени именувани райони (като imot.bg),
// без да претендираме за геодезическа точност.
const NEIGHBORHOOD_PALETTE = [
  "#bfdbfe", // blue-200
  "#fde68a", // amber-200
  "#fbcfe8", // pink-200
  "#ddd6fe", // violet-200
  "#99f6e4", // teal-200
  "#fecaca", // red-200
  "#d9f99d", // lime-200
  "#fed7aa", // orange-200
];

function computeNeighborhoodCells(cityNeighborhoods: MapNeighborhood[]) {
  if (cityNeighborhoods.length < 2) return null;

  return import("d3-delaunay").then(({ Delaunay }) => {
    const points = cityNeighborhoods.map(
      (n) => [n.lng, n.lat] as [number, number],
    );
    const lats = cityNeighborhoods.map((n) => n.lat);
    const lngs = cityNeighborhoods.map((n) => n.lng);
    const latSpan = Math.max(...lats) - Math.min(...lats) || 0.01;
    const lngSpan = Math.max(...lngs) - Math.min(...lngs) || 0.01;
    const bounds: [number, number, number, number] = [
      Math.min(...lngs) - lngSpan * 0.4,
      Math.min(...lats) - latSpan * 0.4,
      Math.max(...lngs) + lngSpan * 0.4,
      Math.max(...lats) + latSpan * 0.4,
    ];

    const voronoi = Delaunay.from(points).voronoi(bounds);

    return cityNeighborhoods
      .map((n, i) => {
        const cell = voronoi.cellPolygon(i);
        if (!cell) return null;
        const latLngs = cell.map(
          ([lng, lat]) => [lat, lng] as [number, number],
        );
        return { neighborhood: n, latLngs };
      })
      .filter((c): c is { neighborhood: MapNeighborhood; latLngs: [number, number][] } => c !== null);
  });
}

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
        zoomSnap: 0.25,
      });
      mapRef.current = map;

      // Без tile слой нарочно — плосък, оцветен диаграмен вид вместо
      // реалистична улична карта.

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

      function showNeighborhoodPoints(
        city: MapCity,
        cityNeighborhoods: MapNeighborhood[],
      ) {
        cityNeighborhoods.forEach((n) => {
          const marker = L.circleMarker([n.lat, n.lng], {
            pane: "markers",
            radius: 6,
            color: "#ffffff",
            weight: 2,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }).addTo(markersLayer);
          marker.bindTooltip(n.name, {
            permanent: true,
            direction: "bottom",
            offset: [0, 4],
            className: "map-label",
          });
          marker.on("click", () => {
            router.push(`/listings?city=${city.id}&neighborhood=${n.id}`);
          });
        });
      }

      async function showNeighborhoodMarkers(
        city: MapCity,
        cityNeighborhoods: MapNeighborhood[],
      ) {
        markersLayer.clearLayers();

        const cellsPromise = computeNeighborhoodCells(cityNeighborhoods);
        if (!cellsPromise) {
          showNeighborhoodPoints(city, cityNeighborhoods);
          return;
        }
        const cells = await cellsPromise;
        if (cancelled) return;

        cells.forEach(({ neighborhood: n, latLngs }, i) => {
          const polygon = L.polygon(latLngs, {
            pane: "markers",
            color: "#334155",
            weight: 1.5,
            fillColor: NEIGHBORHOOD_PALETTE[i % NEIGHBORHOOD_PALETTE.length],
            fillOpacity: 0.85,
          }).addTo(markersLayer);
          polygon.bindTooltip(n.name, {
            permanent: true,
            direction: "center",
            className: "map-label",
          });
          polygon.on("mouseover", () =>
            polygon.setStyle({ fillOpacity: 1, weight: 2.5 }),
          );
          polygon.on("mouseout", () =>
            polygon.setStyle({ fillOpacity: 0.85, weight: 1.5 }),
          );
          polygon.on("click", () => {
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
        className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
      />
    </div>
  );
}
