"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CloudSun, Info, Radar, Truck, Umbrella } from "lucide-react";
import { bdaAPI } from "@/lib/api";
import { axis, Card, chartTooltip, COMPLAINT, ErrorBox, fmt, Loading, RAIN, SectionTitle, Stat, TierPill, useBda } from "@/components/bda/ui";

const WardMap = dynamic(() => import("@/components/bda/WardMap"), { ssr: false, loading: () => <div className="h-[380px] rounded-xl bg-white/[0.02]" /> });

type Outlook = {
  fetchedAt: string;
  source: string;
  method: string;
  stations: { id: string; name: string; dates: string[]; rain: number[]; probability: (number | null)[] }[];
  city: { date: string; rainMm: number; expected: number; normal: number }[];
  wards: {
    id: string;
    name: string;
    zone: string;
    tier: string;
    lat: number;
    lon: number;
    station: string;
    normal: number;
    peak: { date: string; expected: number; rainMm: number };
    series: { date: string; rainMm: number; probability: number | null; expected: number }[];
  }[];
};

const dayLabel = (d: string, i: number) =>
  i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

function heat(v: number) {
  if (v < 0.15) return "#22c55e";
  if (v < 0.5) return "#facc15";
  if (v < 1) return "#f97316";
  return "#ef4444";
}

export default function OutlookPage() {
  const { data, error, loading } = useBda<Outlook>(() => bdaAPI.outlook());
  const [day, setDay] = useState(1);

  if (loading) return <Loading label="Fetching the live rain forecast…" />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} />;

  const d = Math.min(day, data.city.length - 1);
  const city = data.city[d];
  const lift = city.normal ? city.expected / city.normal - 1 : 0;
  const peakDay = data.city.reduce((a, b, i) => (b.expected > data.city[a].expected ? i : a), 0);
  const alerts = data.wards.filter((w) => w.series[d].expected > w.normal * 1.5 && w.series[d].expected - w.normal >= 0.3);
  const maxRain = Math.max(...data.stations.flatMap((s) => s.rain));
  const status = lift > 0.8 ? { label: "Surge expected", color: "#ef4444" } : lift > 0.25 ? { label: "Elevated", color: "#f97316" } : { label: "Normal operations", color: "#22c55e" };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border p-5 relative overflow-hidden" style={{ borderColor: `${status.color}40`, background: `linear-gradient(135deg, ${status.color}14, transparent 60%)` }}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-5 justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ color: status.color }}>
              <Radar className="w-3.5 h-3.5" /> Live · forecast fetched {new Date(data.fetchedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <h2 className="text-2xl font-bold text-white mt-2">{status.label}</h2>
            <p className="text-sm text-white/55 mt-1 max-w-xl">
              Peak load is expected <span className="text-white font-medium">{dayLabel(data.city[peakDay].date, peakDay).toLowerCase()}</span> with about{" "}
              <span className="text-white font-medium">{fmt(data.city[peakDay].expected, 0)} incidents</span> citywide, against{" "}
              {fmt(data.city[peakDay].normal, 0)} on a normal dry day.
            </p>
          </div>
          <div className="flex gap-2">
            {data.city.map((c, i) => (
              <button
                key={c.date}
                onClick={() => setDay(i)}
                className={`rounded-xl px-3 py-2.5 text-left border transition min-w-[92px] ${i === d ? "border-sky-400/60 bg-sky-500/10" : "border-white/[0.07] bg-white/[0.02] hover:border-white/[0.15]"}`}
              >
                <p className="text-[10px] text-white/45">{dayLabel(c.date, i)}</p>
                <p className="text-sm font-bold text-sky-300 tabular-nums mt-0.5 flex items-center gap-1">
                  <Umbrella className="w-3 h-3" /> {fmt(c.rainMm, 1)} mm
                </p>
                <p className="text-[11px] text-white/70 tabular-nums">{fmt(c.expected, 0)} incidents</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Umbrella} label={`Avg rain · ${dayLabel(city.date, d)}`} value={`${fmt(city.rainMm, 1)} mm`} tint="#38bdf8" />
        <Stat icon={CloudSun} label="Expected incidents" value={fmt(city.expected, 0)} hint={`Normal ${fmt(city.normal, 0)}`} tint="#f97316" />
        <Stat icon={AlertTriangle} label="Wards on alert" value={alerts.length} hint="≥ 1.5× their normal load" tint="#ef4444" />
        <Stat icon={Truck} label="Load vs normal" value={`${lift >= 0 ? "+" : ""}${Math.round(lift * 100)}%`} tint="#a78bfa" />
      </div>

      <div className="grid xl:grid-cols-[1.1fr_1fr] gap-4">
        <Card>
          <SectionTitle icon={CloudSun} title="Rain forecast and expected load" subtitle="Bars: forecast rainfall (mm, station average). Line: expected incidents from the MLlib model." />
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={data.city.map((c, i) => ({ ...c, label: dayLabel(c.date, i) }))} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="label" {...axis} />
              <YAxis yAxisId="r" {...axis} />
              <YAxis yAxisId="e" orientation="right" {...axis} />
              <Tooltip {...chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="r" dataKey="rainMm" name="Rain (mm)" fill={RAIN} fillOpacity={0.55} radius={[6, 6, 0, 0]} />
              <Line yAxisId="e" dataKey="expected" name="Expected incidents" stroke={COMPLAINT} strokeWidth={2.2} dot={{ r: 4, fill: COMPLAINT }} />
              <Line yAxisId="e" dataKey="normal" name="Normal (dry)" stroke="rgba(255,255,255,0.35)" strokeDasharray="5 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>

          <p className="text-[11px] font-semibold text-white/70 mt-4 mb-2">Rain gauges — last 3 days and next 4</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-white/35">
                  <th className="text-left font-medium pb-1.5">Station</th>
                  {data.stations[0].dates.map((dt) => (
                    <th key={dt} className="font-medium pb-1.5 text-center">
                      {new Date(dt + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.stations.map((s) => (
                  <tr key={s.id}>
                    <td className="py-1 pr-2 text-white/70">{s.name}</td>
                    {s.rain.map((r, i) => (
                      <td key={i} className="p-0.5">
                        <div
                          className="rounded-md text-center py-1 tabular-nums"
                          style={{ background: `rgba(56,189,248,${0.06 + (maxRain ? (r / maxRain) * 0.6 : 0)})`, color: r > 0 ? "#e0f2fe" : "rgba(255,255,255,0.3)" }}
                          title={s.probability[i] != null ? `${s.probability[i]}% chance` : undefined}
                        >
                          {fmt(r, 1)}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={AlertTriangle} title={`Ward outlook · ${dayLabel(city.date, d)}`} subtitle="Colour shows extra load above each ward's normal." tint="text-orange-400" />
          <WardMap
            height={300}
            points={data.wards.map((w) => {
              const extra = Math.max(0, w.series[d].expected - w.normal);
              return {
                id: w.id,
                name: w.name,
                lat: w.lat,
                lon: w.lon,
                color: heat(extra),
                weight: Math.min(1, w.series[d].expected / 3),
                label: `${fmt(w.series[d].expected, 2)} expected · normal ${fmt(w.normal, 2)} · ${fmt(w.series[d].rainMm, 1)} mm`,
              };
            })}
          />
          <div className="mt-3 space-y-1.5 max-h-[170px] overflow-y-auto">
            {[...data.wards]
              .sort((a, b) => b.series[d].expected - b.normal - (a.series[d].expected - a.normal))
              .slice(0, 6)
              .map((w) => (
                <div key={w.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 text-white/80 truncate">{w.name}</span>
                  <TierPill tier={w.tier} />
                  <span className="tabular-nums text-white/60 w-28 text-right">
                    {fmt(w.series[d].expected, 2)} <span className="text-white/30">/ {fmt(w.normal, 2)}</span>
                  </span>
                </div>
              ))}
          </div>
        </Card>
      </div>

      <p className="text-[10px] text-white/30 flex gap-1.5">
        <Info className="w-3 h-3 shrink-0 mt-px" /> {data.source}. {data.method}
      </p>
    </div>
  );
}
