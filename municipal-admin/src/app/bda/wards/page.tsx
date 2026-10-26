"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Droplets, Map as MapIcon, Repeat, TrendingUp, Users } from "lucide-react";
import { bdaAPI } from "@/lib/api";
import { Card, ErrorBox, fmt, Loading, SectionTitle, SourceNote, TierPill, tierOf, useBda } from "@/components/bda/ui";

const WardMap = dynamic(() => import("@/components/bda/WardMap"), { ssr: false, loading: () => <div className="h-[420px] rounded-xl bg-white/[0.02]" /> });

type Ward = {
  id: string;
  name: string;
  zone: string;
  lat: number;
  lon: number;
  station: string;
  roadKm: number;
  population: number;
  drainageCapacity: number;
  surgeRatio48h: number;
  dryBaseline: number;
  recurrence: number;
  drainageDeficit: number;
  cvi: number;
  rank: number;
  tier: string;
  incidents: number;
  rawReports: number;
  severe: number;
  rainfall: number;
  heavyDays: number;
};

type Mode = "cvi" | "incidents" | "surge";

const MODES: { id: Mode; label: string }[] = [
  { id: "cvi", label: "Vulnerability (CVI)" },
  { id: "incidents", label: "Incident volume" },
  { id: "surge", label: "48h surge" },
];

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / (max || 1)) * 100)}%`, background: color }} />
    </div>
  );
}

export default function WardRiskPage() {
  const { data, error, loading } = useBda<{ wards: Ward[] }>(() => bdaAPI.wards());
  const [mode, setMode] = useState<Mode>("cvi");
  const [selected, setSelected] = useState<string | null>(null);

  const wards = useMemo(() => data?.wards ?? [], [data]);
  const max = useMemo(
    () => ({
      cvi: Math.max(...wards.map((w) => w.cvi || 0), 0.01),
      incidents: Math.max(...wards.map((w) => w.incidents || 0), 1),
      surge: Math.max(...wards.map((w) => w.surgeRatio48h || 0), 0.01),
      recurrence: Math.max(...wards.map((w) => w.recurrence || 0), 1),
    }),
    [wards]
  );

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} />;

  const sel = wards.find((w) => w.id === selected) ?? wards[0];
  const metric = (w: Ward) => (mode === "cvi" ? w.cvi / max.cvi : mode === "incidents" ? w.incidents / max.incidents : w.surgeRatio48h / max.surge);
  const points = wards.map((w) => ({
    id: w.id,
    name: w.name,
    lat: w.lat,
    lon: w.lon,
    color: mode === "cvi" ? tierOf(w.tier).color : mode === "incidents" ? "#f97316" : "#38bdf8",
    weight: metric(w),
    selected: w.id === sel?.id,
    label: mode === "cvi" ? `CVI ${fmt(w.cvi, 2)} · ${tierOf(w.tier).label}` : mode === "incidents" ? `${fmt(w.incidents)} incidents` : `${fmt(w.surgeRatio48h, 1)}× surge at 48h`,
  }));

  return (
    <div className="space-y-4">
      <div className="grid xl:grid-cols-[1.35fr_1fr] gap-4">
        <Card>
          <SectionTitle
            icon={MapIcon}
            title="Ward risk map"
            subtitle="Circle size shows the selected metric. Click a ward to inspect it."
            right={
              <div className="flex rounded-lg bg-white/[0.04] p-0.5">
                {MODES.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    className={`px-2.5 h-7 text-[11px] rounded-md whitespace-nowrap transition ${mode === m.id ? "bg-sky-500/20 text-sky-300" : "text-white/45 hover:text-white/80"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            }
          />
          <WardMap points={points} onSelect={setSelected} height={430} />
          <div className="flex flex-wrap gap-3 mt-3">
            {(["CRITICAL", "MODERATE", "LOW"] as const).map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[11px] text-white/50">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: tierOf(t).color }} /> {tierOf(t).label}: {wards.filter((w) => w.tier === t).length}
              </span>
            ))}
          </div>
        </Card>

        {sel && (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] text-white/35 font-semibold tracking-wider uppercase">
                  Ward {sel.id} · rank #{sel.rank} of {wards.length}
                </p>
                <h3 className="text-lg font-bold text-white mt-0.5">{sel.name}</h3>
                <p className="text-[11px] text-white/45">
                  {sel.zone} · gauge {sel.station.replace(/_/g, " ")}
                </p>
              </div>
              <TierPill tier={sel.tier} />
            </div>

            <div className="mt-5">
              <div className="flex items-end justify-between">
                <p className="text-[11px] text-white/45">Civic Vulnerability Index</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: tierOf(sel.tier).color }}>
                  {fmt(sel.cvi, 3)}
                </p>
              </div>
              <div className="h-2 mt-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${sel.cvi * 100}%`, background: tierOf(sel.tier).color }} />
              </div>
              <p className="text-[10px] text-white/30 mt-1.5">50% rain surge · 35% recurrence · 15% drainage deficit (min-max normalised)</p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              {[
                { icon: TrendingUp, label: "Surge 48h after heavy rain", value: `${fmt(sel.surgeRatio48h, 2)}×`, tint: "#f97316" },
                { icon: Repeat, label: "Recurring surge events", value: fmt(sel.recurrence), tint: "#a78bfa" },
                { icon: Droplets, label: "Drainage capacity", value: `${sel.drainageCapacity} mm/h`, tint: "#38bdf8" },
                { icon: Users, label: "Population (2011)", value: fmt(sel.population), tint: "#22c55e" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                  <m.icon className="w-3.5 h-3.5" style={{ color: m.tint }} />
                  <p className="text-base font-bold text-white mt-1.5 tabular-nums">{m.value}</p>
                  <p className="text-[10px] text-white/40">{m.label}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[
                { label: "Incidents/yr", value: fmt(sel.incidents) },
                { label: "Severe", value: fmt(sel.severe) },
                { label: "Heavy-rain days", value: fmt(sel.heavyDays) },
              ].map((m) => (
                <div key={m.label} className="rounded-lg bg-white/[0.02] py-2">
                  <p className="text-sm font-semibold text-white/85 tabular-nums">{m.value}</p>
                  <p className="text-[10px] text-white/35">{m.label}</p>
                </div>
              ))}
            </div>

            <Link
              href={`/bda/fusion?ward=${encodeURIComponent(sel.id)}`}
              className="mt-4 h-9 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
            >
              See this ward&apos;s rain × complaint history <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Card>
        )}
      </div>

      <Card>
        <SectionTitle icon={TrendingUp} title="All wards ranked by vulnerability" subtitle="Components behind each ward's CVI. Click a row to focus it on the map." />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/35 text-left">
                <th className="font-medium pb-2 pr-3">#</th>
                <th className="font-medium pb-2 pr-3">Ward</th>
                <th className="font-medium pb-2 pr-3">Tier</th>
                <th className="font-medium pb-2 pr-3 w-[15%]">48h surge</th>
                <th className="font-medium pb-2 pr-3 w-[15%]">Recurrence</th>
                <th className="font-medium pb-2 pr-3 w-[15%]">Drainage deficit</th>
                <th className="font-medium pb-2 pr-3 text-right">Incidents</th>
                <th className="font-medium pb-2 text-right">CVI</th>
              </tr>
            </thead>
            <tbody>
              {wards.map((w) => (
                <tr
                  key={w.id}
                  onClick={() => setSelected(w.id)}
                  className={`border-t border-white/[0.05] cursor-pointer transition ${w.id === sel?.id ? "bg-sky-500/[0.06]" : "hover:bg-white/[0.02]"}`}
                >
                  <td className="py-2.5 pr-3 text-white/35 tabular-nums">{w.rank}</td>
                  <td className="py-2.5 pr-3">
                    <p className="text-white/85 font-medium">{w.name}</p>
                    <p className="text-[10px] text-white/30">
                      {w.id} · {w.zone}
                    </p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <TierPill tier={w.tier} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Bar value={w.surgeRatio48h} max={max.surge} color="#f97316" />
                      <span className="text-white/60 tabular-nums w-10 text-right">{fmt(w.surgeRatio48h, 1)}×</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Bar value={w.recurrence} max={max.recurrence} color="#a78bfa" />
                      <span className="text-white/60 tabular-nums w-6 text-right">{w.recurrence}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <div className="flex items-center gap-2">
                      <Bar value={w.drainageDeficit} max={1} color="#38bdf8" />
                      <span className="text-white/60 tabular-nums w-8 text-right">{fmt(w.drainageDeficit, 2)}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-3 text-right text-white/70 tabular-nums">{fmt(w.incidents)}</td>
                  <td className="py-2.5 text-right font-bold tabular-nums" style={{ color: tierOf(w.tier).color }}>
                    {fmt(w.cvi, 3)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SourceNote>gold/fusion/ward_vulnerability + reference/ward_master (24 real BMC wards)</SourceNote>
      </Card>
    </div>
  );
}
