"use client";

import { useEffect, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { SEVERITY_COLORS } from "@/lib/utils";

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
    return <div className="w-full h-full bg-[#0a0b14]" />;
  }

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
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