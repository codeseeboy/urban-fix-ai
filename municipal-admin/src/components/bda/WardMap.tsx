"use client";

import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type WardPoint = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
  /** 0..1 — drives the circle radius. */
  weight: number;
  label: string;
  selected?: boolean;
};

function Fit({ points }: { points: WardPoint[] }) {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize();
    const t = window.setTimeout(run, 80);
    const ro = new ResizeObserver(run);
    ro.observe(map.getContainer());
    return () => {
      window.clearTimeout(t);
      ro.disconnect();
    };
  }, [map]);
  useEffect(() => {
    if (!points.length) return;
    const lats = points.map((p) => p.lat);
    const lons = points.map((p) => p.lon);
    map.fitBounds(
      [
        [Math.min(...lats) - 0.02, Math.min(...lons) - 0.03],
        [Math.max(...lats) + 0.02, Math.max(...lons) + 0.03],
      ],
      { padding: [12, 12] }
    );
    // Fit once per ward set, not on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points.length]);
  return null;
}

/** Mumbai ward centroids as weighted circles on a dark basemap. */
export default function WardMap({ points, onSelect, height = 420 }: { points: WardPoint[]; onSelect?: (id: string) => void; height?: number }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.06]" style={{ height }}>
      <MapContainer center={[19.05, 72.87]} zoom={11} scrollWheelZoom={false} style={{ height: "100%", width: "100%", background: "#06060e" }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; OpenStreetMap &copy; CARTO" />
        <Fit points={points} />
        {points.map((p) => (
          <CircleMarker
            key={p.id}
            center={[p.lat, p.lon]}
            radius={8 + p.weight * 22}
            pathOptions={{
              color: p.selected ? "#ffffff" : p.color,
              weight: p.selected ? 3 : 1.5,
              fillColor: p.color,
              fillOpacity: p.selected ? 0.55 : 0.32,
            }}
            eventHandlers={{ click: () => onSelect?.(p.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <div style={{ fontSize: 12 }}>
                <strong>{p.name}</strong> <span style={{ opacity: 0.6 }}>({p.id})</span>
                <br />
                {p.label}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
