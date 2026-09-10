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
//
// Един топъл неутрален тон за всички клетки (като imot.bg) вместо пъстра
// палитра по клетка — пъстрото изглеждаше като "бонбонки", не като карта.
const NEIGHBORHOOD_FILL = "#ede4d3";
const NEIGHBORHOOD_FILL_HOVER = "#a7f3d0";
const NEIGHBORHOOD_BORDER = "#a89572";

// Sutherland-Hodgman: clip `subject` against the convex polygon `clip`
// (vertices must be counter-clockwise, which is what Delaunay.hull gives
// us). Used below to trim each Voronoi cell to an organic city outline
// instead of the artificial straight-edged rectangle it'd otherwise be
// clipped to — that rectangle was the "looks like a box, not a map" issue.
function isLeftOf(p: number[], a: number[], b: number[]) {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
}

function segmentIntersection(
  p1: number[],
  p2: number[],
  a: number[],
  b: number[],
) {
  const A1 = p2[1] - p1[1];
  const B1 = p1[0] - p2[0];
  const C1 = A1 * p1[0] + B1 * p1[1];
  const A2 = b[1] - a[1];
  const B2 = a[0] - b[0];
  const C2 = A2 * a[0] + B2 * a[1];
  const det = A1 * B2 - A2 * B1;
  if (Math.abs(det) < 1e-12) return p1;
  return [(B2 * C1 - B1 * C2) / det, (A1 * C2 - A2 * C1) / det];
}

function clipToConvexPolygon(subject: number[][], clip: number[][]) {
  let output = subject;
  for (let i = 0; i < clip.length && output.length > 0; i++) {
    const clipStart = clip[i];
    const clipEnd = clip[(i + 1) % clip.length];
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const prev = input[(j - 1 + input.length) % input.length];
      const currentInside = isLeftOf(current, clipStart, clipEnd);
      const prevInside = isLeftOf(prev, clipStart, clipEnd);
      if (currentInside) {
        if (!prevInside) {
          output.push(segmentIntersection(prev, current, clipStart, clipEnd));
        }
        output.push(current);
      } else if (prevInside) {
        output.push(segmentIntersection(prev, current, clipStart, clipEnd));
      }
    }
  }
  return output;
}

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
  // Generous bounds just so the Voronoi cells aren't truncated before the
  // real (hull-shaped) clip below runs.
  const bounds: [number, number, number, number] = [
    Math.min(...lngs) - lngSpan * 0.8,
    Math.min(...lats) - latSpan * 0.8,
    Math.max(...lngs) + lngSpan * 0.8,
    Math.max(...lats) + latSpan * 0.8,
  ];

  const delaunay = Delaunay.from(points);
  const voronoi = delaunay.voronoi(bounds);

  // The convex hull of the neighborhood points, pushed outward from the
  // centroid, gives an organic outer boundary that follows how the city's
  // points actually spread out — instead of an axis-aligned box.
  let hullPoints = Array.from(delaunay.hull).map((i) => points[i]);
  // delaunay.hull's winding direction isn't guaranteed CW or CCW for a
  // given point set — clipToConvexPolygon assumes CCW, so normalize it
  // (a CW clip polygon makes every point test as "outside", clipping
  // every cell away to nothing).
  const hullSignedArea2x = hullPoints.reduce((sum, [x0, y0], i) => {
    const [x1, y1] = hullPoints[(i + 1) % hullPoints.length];
    return sum + (x0 * y1 - x1 * y0);
  }, 0);
  if (hullSignedArea2x < 0) hullPoints = hullPoints.slice().reverse();
  const centroid = hullPoints.reduce(
    (acc, [x, y]) => [acc[0] + x / hullPoints.length, acc[1] + y / hullPoints.length],
    [0, 0],
  );
  const HULL_EXPAND = 1.35;
  const expandedHull = hullPoints.map(([x, y]) => [
    centroid[0] + (x - centroid[0]) * HULL_EXPAND,
    centroid[1] + (y - centroid[1]) * HULL_EXPAND,
  ]);

  return cityNeighborhoods
    .map((n, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell) return null;
      const clipped = clipToConvexPolygon(cell, expandedHull);
      if (clipped.length < 3) return null;
      const latLngs = clipped.map(
        ([lng, lat]) => [lat, lng] as [number, number],
      );
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
            fillColor: "#059669",
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

      cells.forEach(({ neighborhood: n, latLngs }) => {
        const polygon = L.polygon(latLngs, {
          pane: "markers",
          color: NEIGHBORHOOD_BORDER,
          weight: 1.5,
          fillColor: NEIGHBORHOOD_FILL,
          fillOpacity: 1,
        }).addTo(map);
        polygon.bindTooltip(n.name, {
          permanent: true,
          direction: "center",
          className: "map-label",
        });
        polygon.on("mouseover", () =>
          polygon.setStyle({ fillColor: NEIGHBORHOOD_FILL_HOVER, weight: 2.5 }),
        );
        polygon.on("mouseout", () =>
          polygon.setStyle({ fillColor: NEIGHBORHOOD_FILL, weight: 1.5 }),
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
