"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import { SEVERITY_COLORS } from "@/lib/utils";
import "leaflet/dist/leaflet.css";

/** Leaflet must measure the container after layout; flex + Next dynamic import often starts at 0×0. */
function MapResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const run = () => {
      map.invalidateSize();
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    const t1 = window.setTimeout(run, 50);
    const t2 = window.setTimeout(run, 400);
    window.addEventListener("resize", run);
    return () => {
      ro.disconnect();
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", run);
    };
  }, [map]);
  return null;
}

interface Issue {
  _id: string;
  title: string;
  status: string;
  aiSeverity: string;
  category: string;
  location?: { coordinates?: number[]; address?: string };
  emergency?: boolean;
  createdAt: string;
  upvotes?: string[];
}

interface IssueMapProps {
  center: { lat: number; lng: number };
  issues: Issue[];
  showHeatmap: boolean;
  onSelectIssue: (issue: Issue) => void;
}

export default function IssueMap({ center, issues, showHeatmap, onSelectIssue }: IssueMapProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  if (!isMounted) {
    return <div className="h-full min-h-[280px] w-full bg-[#0a0b14]" />;
  }

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="z-0 h-full w-full min-h-[280px]"
      style={{ height: "100%", width: "100%", minHeight: 280 }}
      zoomControl={false}
      scrollWheelZoom
    >
      <MapResize />
      <TileLayer
        /* Single subdomain avoids rare {s} resolution issues; dark basemap */
        url="https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        maxZoom={19}
        maxNativeZoom={19}
      />
      {issues.map((issue) => {
        const lat = issue.location!.coordinates![1];
        const lng = issue.location!.coordinates![0];
        const color = SEVERITY_COLORS[issue.aiSeverity] || "#888";

        return (
          <CircleMarker
            key={issue._id}
            center={[lat, lng]}
            radius={showHeatmap ? (issue.aiSeverity === "Critical" ? 18 : issue.aiSeverity === "High" ? 14 : 10) : 6}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: showHeatmap ? 0.2 : 0.7,
              weight: showHeatmap ? 0 : 2,
            }}
            eventHandlers={{ click: () => onSelectIssue(issue) }}
          >
            <Popup>
              <div className="text-xs min-w-[180px]">
                <p className="font-semibold text-gray-900">{issue.title}</p>
                <p className="text-gray-500 mt-1">{issue.location?.address}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-semibold" style={{ color }}>{issue.aiSeverity}</span>
                  <span className="text-gray-400">•</span>
                  <span>{issue.status}</span>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}