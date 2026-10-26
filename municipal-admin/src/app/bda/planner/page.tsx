"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AlertTriangle, CloudRain, Gauge, Info, Siren, Truck } from "lucide-react";
import { bdaAPI } from "@/lib/api";
import { Card, ErrorBox, fmt, Loading, SectionTitle, TierPill, useBda } from "@/components/bda/ui";

const WardMap = dynamic(() => import("@/components/bda/WardMap"), { ssr: false, loading: () => <div className="h-[380px] rounded-xl bg-white/[0.02]" /> });

type Planner = {
  rainMm: number;
  lagDays: number;
  band: { id: string; label: string };
  expectedTotal: number;
  dryTotal: number;
  cityLift: number | null;
  method: string;
  wards: {
    id: string;
    name: string;
    zone: string;
    tier: string;
    cvi: number;
    lat: number;
    lon: number;
    expectedIncidents: number | null;
    dryBaseline: number | null;
    lift: number | null;
    samples: number;
  }[];
};

const PRESETS = [
  { mm: 0, label: "Dry day" },
  { mm: 12, label: "Light showers" },
  { mm: 30, label: "Moderate rain" },
  { mm: 65, label: "Heavy rain (IMD)" },
  { mm: 120, label: "Very heavy" },
];

function heat(v: number) {
  // 0..1 → cool blue to hot red
  const stops = ["#38bdf8", "#facc15", "#f97316", "#ef4444"];
  return stops[Math.min(stops.length - 1, Math.floor(v * stops.length))];
}

export default function PlannerPage() {
  const [rain, setRain] = useState(65);
  const [debounced, setDebounced] = useState(65);
  const [lag, setLag] = useState(2);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(rain), 250);
    return () => clearTimeout(t);
  }, [rain]);

  const { data, error, loading } = useBda<Planner>(() => bdaAPI.planner(debounced, lag), [debounced, lag]);

  const max = Math.max(...(data?.wards.map((w) => w.expectedIncidents ?? 0) ?? [1]), 0.01);
  const sorted = data?.wards ?? [];
  const cut = sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length / 4) - 1)].expectedIncidents ?? 0 : 0;

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <div className="absolute -left-16 -bottom-24 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-6 items-center">
          <div>
            <SectionTitle
              icon={Gauge}
              title="Monsoon surge planner"
              subtitle="Enter the rainfall forecast. The planner looks up how many incidents each ward actually produced after days with similar rain, then ranks where to send crews first."
            />
            <div className="flex items-baseline gap-2">
              <CloudRain className="w-5 h-5 text-sky-400 self-center" />
              <span className="text-4xl font-bold text-white tabular-nums">{rain}</span>
              <span className="text-sm text-white/45">mm forecast</span>
              {data && <span className="ml-2 text-[11px] text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full">{data.band.label}</span>}
            </div>
            <input
              type="range"
              min={0}
              max={150}
              value={rain}
              onChange={(e) => setRain(Number(e.target.value))}
              className="w-full mt-4 accent-sky-400"
              aria-label="Rainfall forecast in millimetres"
            />
            <div className="flex flex-wrap gap-2 mt-3">
              {PRESETS.map((p) => (
                <button
                  key={p.mm}
                  onClick={() => setRain(p.mm)}
                  className={`px-2.5 h-7 rounded-lg text-[11px] border transition ${
                    rain === p.mm ? "border-sky-400/50 bg-sky-500/15 text-sky-200" : "border-white/[0.08] text-white/50 hover:text-white/80"
                  }`}
                >
                  {p.label} · {p.mm}mm
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[11px] text-white/45">Plan for</span>
              <div className="flex rounded-lg bg-white/[0.04] p-0.5">
                {[0, 1, 2, 3].map((l) => (
                  <button
                    key={l}
                    onClick={() => setLag(l)}
                    className={`px-2.5 h-7 text-[11px] rounded-md transition ${lag === l ? "bg-sky-500/20 text-sky-300" : "text-white/45 hover:text-white/80"}`}
                  >
                    {l === 0 ? "same day" : `+${l * 24}h`}
                  </button>
                ))}
              </div>
              {lag === 2 && <span className="text-[10px] text-orange-400">peak lag</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-[11px] text-white/45">Expected incidents citywide</p>
              <p className="text-3xl font-bold text-orange-400 tabular-nums mt-1">{data ? fmt(data.expectedTotal, 0) : "—"}</p>
              <p className="text-[10px] text-white/30 mt-1">vs {data ? fmt(data.dryTotal, 0) : "—"} on a dry day</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-[11px] text-white/45">Load vs normal</p>
              <p className="text-3xl font-bold text-white tabular-nums mt-1">{data?.cityLift ? `${fmt(data.cityLift, 1)}×` : "—"}</p>
              <p className="text-[10px] text-white/30 mt-1">{lag === 0 ? "same day" : `${lag * 24}h after the rain`}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-orange-500/[0.06] border border-orange-500/20 p-4 flex gap-3">
              <Truck className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-white">Pre-position first in</p>
                <p className="text-[11px] text-white/60 mt-1">
                  {sorted
                    .slice(0, 4)
                    .map((w) => w.name)
                    .join(" · ") || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorBox message={error} />
      ) : loading && !data ? (
        <Loading label="Running the planner over historical ward-days…" />
      ) : data ? (
        <div className="grid xl:grid-cols-[1fr_1.2fr] gap-4">
          <Card>
            <SectionTitle icon={Siren} title="Expected load by ward" subtitle="Hotter and larger means more incidents expected." tint="text-orange-400" />
            <WardMap
              height={380}
              points={data.wards.map((w) => {
                const v = (w.expectedIncidents ?? 0) / max;
                return {
                  id: w.id,
                  name: w.name,
                  lat: w.lat,
                  lon: w.lon,
                  color: heat(v * 0.999),
                  weight: v,
                  label: `${fmt(w.expectedIncidents, 1)} expected incidents (${fmt(w.lift, 1)}× normal)`,
                };
              })}
            />
            <p className="text-[10px] text-white/30 mt-3 flex gap-1.5">
              <Info className="w-3 h-3 shrink-0 mt-px" /> {data.method}
            </p>
          </Card>

          <Card>
            <SectionTitle icon={AlertTriangle} title="Dispatch priority" subtitle="Top quarter of wards by expected incidents are flagged for pre-positioning." tint="text-amber-400" />
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-[#0d0d18]">
                  <tr className="text-white/35 text-left">
                    <th className="font-medium pb-2 pr-2">#</th>
                    <th className="font-medium pb-2 pr-2">Ward</th>
                    <th className="font-medium pb-2 pr-2 w-[30%]">Expected incidents</th>
                    <th className="font-medium pb-2 pr-2 text-right">vs dry</th>
                    <th className="font-medium pb-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((w, i) => {
                    const priority = (w.expectedIncidents ?? 0) >= cut && (w.expectedIncidents ?? 0) > (w.dryBaseline ?? 0);
                    return (
                      <tr key={w.id} className="border-t border-white/[0.05]">
                        <td className="py-2 pr-2 text-white/35 tabular-nums">{i + 1}</td>
                        <td className="py-2 pr-2">
                          <p className="text-white/85 font-medium">{w.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <TierPill tier={w.tier} />
                            <span className="text-[10px] text-white/25">{w.samples} similar days</span>
                          </div>
                        </td>
                        <td className="py-2 pr-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 rounded-full bg-white/[0.05] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${((w.expectedIncidents ?? 0) / max) * 100}%`, background: heat(((w.expectedIncidents ?? 0) / max) * 0.999) }} />
                            </div>
                            <span className="text-white/80 tabular-nums w-9 text-right">{fmt(w.expectedIncidents, 1)}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-2 text-right text-white/55 tabular-nums">{w.lift ? `${fmt(w.lift, 1)}×` : "—"}</td>
                        <td className="py-2 text-right">
                          {priority ? (
                            <span className="text-[10px] font-semibold text-orange-300 bg-orange-500/10 px-2 py-0.5 rounded-full whitespace-nowrap">Pre-position crew</span>
                          ) : (
                            <span className="text-[10px] text-white/30">Normal roster</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
