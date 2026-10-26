"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Activity, CalendarRange, CloudRain, Droplets, Timer, Waves } from "lucide-react";
import {
  Bar, BarChart, Brush, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
} from "recharts";
import { bdaAPI } from "@/lib/api";
import { axis, Card, chartTooltip, COMPLAINT, ErrorBox, fmt, Loading, RAIN, SectionTitle, SourceNote, TierPill, useBda } from "@/components/bda/ui";

type Fusion = {
  ward: { id: string; name: string; zone: string; tier: string; cvi: number; drainageCapacity: number } | null;
  daily: { date: string; rainMm: number; incidents: number; rawReports: number; severe: number }[];
  monthly: { month: string; rainMm: number; incidents: number; rawReports: number; heavyDays: number }[];
  lag: Record<string, number>;
  response: Record<string, { bin: string; label: string; avg: number | null; samples: number }[]>;
  episodes: { date: string; rainMm: number; maxRainMm: number; wardsHeavy: number; incidentsNext72h: number; liftVsAverage: number | null }[];
  stations: { station: string; totalMm: number; rainyDays: number; heavyDays: number; maxMm: number; maxDate: string }[];
};

type Wards = { wards: { id: string; name: string }[] };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const BIN_COLORS: Record<string, string> = { dry: "#64748b", light: "#7dd3fc", moderate: "#38bdf8", heavy: "#f97316" };

function FusionInner() {
  const params = useSearchParams();
  const [ward, setWard] = useState(params.get("ward") ?? "");
  const [lagDays, setLagDays] = useState("2");
  const wards = useBda<Wards>(() => bdaAPI.wards());
  const { data, error, loading } = useBda<Fusion>(() => bdaAPI.fusion(ward || undefined), [ward]);

  const monsoon = useMemo(() => {
    if (!data) return null;
    const m = data.monthly.filter((x) => ["06", "07", "08", "09"].includes(x.month.slice(5)));
    const all = data.monthly.reduce((s, x) => s + x.incidents, 0);
    const rain = data.monthly.reduce((s, x) => s + x.rainMm, 0);
    return {
      share: all ? m.reduce((s, x) => s + x.incidents, 0) / all : 0,
      rainShare: rain ? m.reduce((s, x) => s + x.rainMm, 0) / rain : 0,
    };
  }, [data]);

  if (error) return <ErrorBox message={error} />;

  const response = data?.response?.[lagDays] ?? [];
  const dry = response.find((r) => r.bin === "dry")?.avg ?? 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={ward}
          onChange={(e) => setWard(e.target.value)}
          className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/80 focus:outline-none"
        >
          <option value="">All 24 wards (citywide)</option>
          {wards.data?.wards.map((w) => (
            <option key={w.id} value={w.id}>
              {w.id} — {w.name}
            </option>
          ))}
        </select>
        {data?.ward && (
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <TierPill tier={data.ward.tier} /> {data.ward.zone} · drainage {data.ward.drainageCapacity} mm/h · CVI {fmt(data.ward.cvi, 2)}
          </div>
        )}
      </div>

      {loading || !data ? (
        <Loading />
      ) : (
        <>
          {/* Main dual-axis series */}
          <Card>
            <SectionTitle
              icon={Activity}
              title={`Daily rainfall vs complaints${data.ward ? ` — ${data.ward.name}` : " — citywide"}`}
              subtitle="Bars: rainfall (mm, real ERA5). Line: distinct incidents after dedup. Drag the handles below to zoom into the monsoon."
            />
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={data.daily} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${Number(d.slice(8))}`} minTickGap={40} />
                <YAxis yAxisId="rain" {...axis} />
                <YAxis yAxisId="inc" orientation="right" {...axis} />
                <Tooltip {...chartTooltip} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
                <Bar yAxisId="rain" dataKey="rainMm" name="Rainfall (mm)" fill={RAIN} fillOpacity={0.55} radius={[2, 2, 0, 0]} />
                <Line yAxisId="inc" type="monotone" dataKey="incidents" name="Incidents" stroke={COMPLAINT} strokeWidth={1.8} dot={false} />
                <Brush dataKey="date" height={22} stroke="rgba(56,189,248,0.5)" fill="rgba(255,255,255,0.02)" travellerWidth={8} startIndex={150} endIndex={260} tickFormatter={() => ""} />
              </ComposedChart>
            </ResponsiveContainer>
            <SourceNote>gold/fusion/ward_date_fused_gold — ward × date join of silver reports and daily station rainfall</SourceNote>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Response curve */}
            <Card>
              <SectionTitle
                icon={Waves}
                title="How much rain triggers how many complaints"
                subtitle="Average incidents per ward-day, N days after a day in each rain band."
                right={
                  <div className="flex rounded-lg bg-white/[0.04] p-0.5">
                    {["0", "1", "2", "3"].map((l) => (
                      <button
                        key={l}
                        onClick={() => setLagDays(l)}
                        className={`px-2.5 h-7 text-[11px] rounded-md transition ${lagDays === l ? "bg-sky-500/20 text-sky-300" : "text-white/45 hover:text-white/80"}`}
                      >
                        +{Number(l) * 24}h
                      </button>
                    ))}
                  </div>
                }
              />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={response} margin={{ top: 18, right: 5, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" {...axis} interval={0} tick={{ ...axis.tick, fontSize: 10 }} />
                  <YAxis {...axis} />
                  <Tooltip {...chartTooltip} formatter={(v, _n, p) => [`${fmt(Number(v), 2)} incidents/day · ${fmt((p as { payload?: { samples?: number } }).payload?.samples)} ward-days`, "Average"]} />
                  <Bar dataKey="avg" radius={[6, 6, 0, 0]} label={{ position: "top", fill: "rgba(255,255,255,0.6)", fontSize: 11, formatter: (v: unknown) => (dry ? `${(Number(v) / dry).toFixed(1)}×` : "") }}>
                    {response.map((r) => (
                      <Cell key={r.bin} fill={BIN_COLORS[r.bin]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[11px] text-white/45 mt-2">
                Labels show the lift over dry days. The effect builds after the rain stops — compare +0h with +48h.
              </p>
            </Card>

            {/* Lag surge (Spark output) */}
            <Card>
              <SectionTitle icon={Timer} title="Lag analysis (Spark)" subtitle="Heavy-rain complaint rate ÷ dry-day baseline, averaged over wards." />
              <div className="space-y-4 mt-2">
                {[24, 48, 72].map((l) => {
                  const val = data.lag[`${l}h`] ?? 0;
                  const peak = data.lag.peak_lag_hours === l;
                  return (
                    <div key={l}>
                      <div className="flex justify-between text-xs mb-1.5">
                        <span className={peak ? "text-white font-semibold" : "text-white/55"}>
                          {l} hours after heavy rain {peak && <span className="text-[10px] text-orange-400 ml-1">PEAK</span>}
                        </span>
                        <span className={`tabular-nums ${peak ? "text-orange-400 font-bold" : "text-white/60"}`}>{fmt(val, 2)}×</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div
                          className={`h-full rounded-full ${peak ? "bg-gradient-to-r from-orange-600 to-orange-400" : "bg-sky-500/50"}`}
                          style={{ width: `${(val / 5) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-white/30 mt-1">{fmt(data.lag[`${l}h_ward_days`])} heavy-rain ward-days</p>
                    </div>
                  );
                })}
              </div>
              {monsoon && (
                <div className="grid grid-cols-2 gap-3 mt-5">
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <p className="text-lg font-bold text-sky-300">{Math.round(monsoon.rainShare * 100)}%</p>
                    <p className="text-[10px] text-white/40">of the year&apos;s rain falls Jun–Sep</p>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] p-3">
                    <p className="text-lg font-bold text-orange-300">{Math.round(monsoon.share * 100)}%</p>
                    <p className="text-[10px] text-white/40">of incidents arrive in the same 4 months</p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
            {/* Seasonality */}
            <Card>
              <SectionTitle icon={CalendarRange} title="Seasonality" subtitle="Monthly rainfall and incident totals (citywide)." />
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={data.monthly.map((m) => ({ ...m, label: MONTHS[Number(m.month.slice(5)) - 1] }))} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" {...axis} />
                  <YAxis yAxisId="rain" {...axis} />
                  <YAxis yAxisId="inc" orientation="right" {...axis} />
                  <Tooltip {...chartTooltip} />
                  <Bar yAxisId="rain" dataKey="rainMm" name="Rainfall (mm)" fill={RAIN} fillOpacity={0.5} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="inc" type="monotone" dataKey="incidents" name="Incidents" stroke={COMPLAINT} strokeWidth={2} dot={{ r: 3, fill: COMPLAINT }} />
                </ComposedChart>
              </ResponsiveContainer>
            </Card>

            {/* Episodes */}
            <Card>
              <SectionTitle icon={CloudRain} title="Worst heavy-rain episodes" subtitle="Ranked by incidents in the following 72 hours." />
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/35 text-left">
                      <th className="font-medium pb-2">Date</th>
                      <th className="font-medium pb-2 text-right">Avg rain</th>
                      <th className="font-medium pb-2 text-right">Wards ≥45mm</th>
                      <th className="font-medium pb-2 text-right">Next 72h</th>
                      <th className="font-medium pb-2 text-right">Lift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.episodes.slice(0, 8).map((e) => (
                      <tr key={e.date} className="border-t border-white/[0.05]">
                        <td className="py-2 text-white/80">{new Date(e.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                        <td className="py-2 text-right text-sky-300 tabular-nums">{fmt(e.rainMm, 1)} mm</td>
                        <td className="py-2 text-right text-white/60 tabular-nums">{e.wardsHeavy}/24</td>
                        <td className="py-2 text-right text-white/80 tabular-nums">{fmt(e.incidentsNext72h)}</td>
                        <td className="py-2 text-right text-orange-400 font-semibold tabular-nums">{fmt(e.liftVsAverage, 1)}×</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Stations */}
          <Card>
            <SectionTitle icon={Droplets} title="Rain gauges (real data)" subtitle="Open-Meteo ERA5 daily precipitation for the stations each ward is mapped to." />
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {data.stations.map((s) => (
                <div key={s.station} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                  <p className="text-[11px] font-semibold text-white/80">{s.station.replace(/_/g, " ")}</p>
                  <p className="text-xl font-bold text-sky-300 mt-1 tabular-nums">{fmt(s.totalMm)} mm</p>
                  <p className="text-[10px] text-white/40 mt-1">
                    {s.rainyDays} rainy days · {s.heavyDays} heavy
                  </p>
                  <p className="text-[10px] text-white/30">Max {fmt(s.maxMm, 1)} mm on {s.maxDate}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export default function FusionPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FusionInner />
    </Suspense>
  );
}
