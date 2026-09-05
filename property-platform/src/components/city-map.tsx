"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap } from "leaflet";

export type CityMapCity = { id: string; name: string };
export type CityMapNeighborhood = {
  id: string;
  city_id: string;
  name: string;
  lat: number;
  lng: number;
};

// Нямаме реални полигонни граници на кварталите (виж CLAUDE.md за
// контекст), затова изграждаме Voronoi диаграма от координатите, които
// вече имаме — всяка точка получава клетка от равнината, най-близка до
// нея. Изглежда като разделени именувани райони, без да претендираме за
// геодезическа точност.
const NEIGHBORHOOD_PALETTE = [
  "#bfdbfe",
  "#fde68a",
  "#fbcfe8",
  "#ddd6fe",
  "#99f6e4",
  "#fecaca",
  "#d9f99d",
  "#fed7aa",
];

async function computeNeighborhoodCells(
  cityNeighborhoods: CityMapNeighborhood[],
) {
  if (cityNeighborhoods.length < 2) return null;

  const { Delaunay } = await import("d3-delaunay");
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
      const latLngs = cell.map(([lng, lat]) => [lat, lng] as [number, number]);
      return { neighborhood: n, latLngs };
    })
    .filter(
      (c): c is { neighborhood: CityMapNeighborhood; latLngs: [number, number][] } =>
        c !== null,
    );
}

export function CityMap({
  city,
  neighborhoods,
}: {
  city: CityMapCity;
  neighborhoods: CityMapNeighborhood[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const bounds = L.latLngBounds(
        neighborhoods.map((n) => [n.lat, n.lng] as [number, number]),
      );

      const map = L.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomSnap: 0.25,
      });
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      mapRef.current = map;

      const markersPane = map.createPane("markers");
      markersPane.style.zIndex = "450";

      const cells = await computeNeighborhoodCells(neighborhoods);
      if (cancelled) return;

      if (!cells) {
        neighborhoods.forEach((n) => {
          const marker = L.circleMarker([n.lat, n.lng], {
            pane: "markers",
            radius: 7,
            color: "#ffffff",
            weight: 2,
            fillColor: "#2563eb",
            fillOpacity: 1,
          }).addTo(map);
          marker.bindTooltip(n.name, {
            permanent: true,
            direction: "bottom",
            offset: [0, 5],
            className: "map-label",
          });
          marker.on("click", () => {
            router.push(`/listings?city=${city.id}&neighborhood=${n.id}`);
          });
        });
        return;
      }

      cells.forEach(({ neighborhood: n, latLngs }, i) => {
        const polygon = L.polygon(latLngs, {
          pane: "markers",
          color: "#334155",
          weight: 1.5,
          fillColor: NEIGHBORHOOD_PALETTE[i % NEIGHBORHOOD_PALETTE.length],
          fillOpacity: 0.85,
        }).addTo(map);
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

    init();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="aspect-[4/3] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 sm:aspect-video"
    />
  );
}
