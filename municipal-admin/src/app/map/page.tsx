"use client";

import { useEffect, useMemo, useState } from "react";
import { issuesAPI } from "@/lib/api";
import { SEVERITY_COLORS, STATUS_COLORS } from "@/lib/utils";
import dynamic from "next/dynamic";
import { MapPin, Flame, Eye, X } from "lucide-react";
import Link from "next/link";

const IssueMap = dynamic(() => import("@/components/map/IssueMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0a0b14]" />,
});

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

export default function MapPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("All");
  const [sevFilter, setSevFilter] = useState("All");
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  useEffect(() => {
    issuesAPI
      .getFeed({ limit: 500 })
      .then(({ data }) => setIssues(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return issues.filter((i) => {
      if (!i.location?.coordinates) return false;
      if (statusFilter !== "All" && i.status !== statusFilter) return false;
      if (sevFilter !== "All" && i.aiSeverity !== sevFilter) return false;
      return true;
    });
  }, [issues, statusFilter, sevFilter]);

  const center = useMemo(() => {
    const withCoords = filtered.filter((i) => i.location?.coordinates);
    if (withCoords.length === 0) return { lat: 19.83, lng: 72.8 };
    const avgLat = withCoords.reduce((s, i) => s + i.location!.coordinates![1], 0) / withCoords.length;
    const avgLng = withCoords.reduce((s, i) => s + i.location!.coordinates![0], 0) / withCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [filtered]);

  const sevCounts = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach((i) => {
      m[i.aiSeverity] = (m[i.aiSeverity] || 0) + 1;
    });
    return m;
  }, [filtered]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-white/40">Loading civic map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 bg-[#06060e]">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-400" /> Civic Map
          </h1>
          <p className="text-[10px] sm:text-xs text-white/40 mt-0.5">{filtered.length} issues plotted</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] text-white/60 focus:outline-none"
          >
            <option value="All">All Status</option>
            {["Submitted", "InProgress", "Resolved"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={sevFilter}
            onChange={(e) => setSevFilter(e.target.value)}
            className="h-8 px-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-[11px] text-white/60 focus:outline-none"
          >
            <option value="All">All Severity</option>
            {["Critical", "High", "Medium", "Low"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`h-8 px-3 rounded-lg text-[11px] font-medium flex items-center gap-1.5 border transition whitespace-nowrap ${showHeatmap ? "bg-orange-500/15 border-orange-500/30 text-orange-400" : "bg-white/[0.04] border-white/[0.08] text-white/50"}`}
          >
            <Flame className="w-3 h-3" /> Heatmap
          </button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <IssueMap
          center={center}
          issues={filtered}
          showHeatmap={showHeatmap}
          onSelectIssue={setSelectedIssue}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 glass-card p-3 z-[1000]">
          <p className="text-[10px] text-white/40 mb-2 font-medium">SEVERITY LEGEND</p>
          <div className="space-y-1.5">
            {Object.entries(SEVERITY_COLORS).map(([name, color]) => (
              <div key={name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-white/60">
                  {name} ({sevCounts[name] || 0})
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Issue Card */}
        {selectedIssue && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 glass-card p-4 sm:w-80 z-[1000] animate-slide-up">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-xs font-semibold text-white flex-1 mr-2">
                {selectedIssue.emergency && <span className="text-red-400 mr-1">🚨</span>}
                {selectedIssue.title}
              </h3>
              <button onClick={() => setSelectedIssue(null)} className="text-white/30 hover:text-white/60">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-white/40 mb-2">{selectedIssue.location?.address}</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: SEVERITY_COLORS[selectedIssue.aiSeverity], background: SEVERITY_COLORS[selectedIssue.aiSeverity] + "18" }}>
                {selectedIssue.aiSeverity}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: STATUS_COLORS[selectedIssue.status], background: STATUS_COLORS[selectedIssue.status] + "18" }}>
                {selectedIssue.status}
              </span>
            </div>
            <Link href={`/issues/${selectedIssue._id}`} className="w-full h-8 bg-blue-500 hover:bg-blue-600 text-white text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition">
              <Eye className="w-3 h-3" /> View Details
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
