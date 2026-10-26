"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { BrainCircuit, CheckCircle2, LineChart as LineIcon, Layers, Sigma, Target } from "lucide-react";
import { bdaAPI } from "@/lib/api";
import { axis, Card, chartTooltip, COMPLAINT, ErrorBox, fmt, Loading, SectionTitle, SourceNote, Stat, TierPill, useBda } from "@/components/bda/ui";

type Metric = { rmse: number; mae: number; r2: number };
type Ml = {
  question: string;
  split: string;
  train_rows: number;
  test_rows: number;
  features: string[];
  models: Record<string, Metric>;
  best_model: string;
  rmse_improvement_vs_baseline: number;
  wet_day_rmse_improvement_vs_baseline: number;
  random_forest_params: Record<string, number>;
  scenario_assumptions: string;
  importance: { feature: string; importance: number }[];
  test: { calendar_date: string; actual: number; predicted: number; baseline: number; rain_mm: number }[];
  cityScenario: { rain: number; h0: number; h1: number; h2: number; h3: number }[];
  wardAt65: { id: string; name: string; tier: string; dry: number; heavy: number }[];
  updatedAt: string;
};

const FEATURE_LABEL: Record<string, string> = {
  ward: "Ward identity",
  rain_d0: "Rain today",
  rain_d1: "Rain 1 day ago",
  rain_d2: "Rain 2 days ago",
  rain_d3: "Rain 3 days ago",
  rain_2d: "2-day rain total",
  month: "Month",
  is_monsoon: "Monsoon season",
  drainage_capacity: "Drainage capacity",
};

const MODEL_LABEL: Record<string, string> = {
  random_forest: "Random Forest",
  linear_regression: "Linear Regression",
  baseline_ward_mean: "Baseline (ward average)",
};

const H_COLORS = ["#7dd3fc", "#38bdf8", "#f97316", "#a78bfa"];

export default function MlPage() {
  const { data, error, loading } = useBda<Ml>(() => bdaAPI.ml());
  if (loading) return <Loading label="Loading the MLlib model outputs…" />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} />;

  const models = ["random_forest", "linear_regression", "baseline_ward_mean"].map((k) => ({ key: k, label: MODEL_LABEL[k], ...data.models[k] }));
  const maxImp = Math.max(...data.importance.map((i) => i.importance));

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-violet-300 bg-violet-500/10 border border-violet-500/20 px-2 py-1 rounded-full">
            <BrainCircuit className="w-3 h-3" /> Spark MLlib · spark/08_mllib_forecast.py
          </span>
          <h2 className="text-lg sm:text-xl font-bold text-white mt-3">{data.question}</h2>
          <p className="text-xs text-white/45 mt-1">
            Trained on {fmt(data.train_rows)} ward-days, evaluated on {fmt(data.test_rows)} held-out ward-days ({data.split}). Model trained{" "}
            {new Date(data.updatedAt).toLocaleString()}.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Target} label="Error reduction vs baseline" value={`${Math.round(data.rmse_improvement_vs_baseline * 100)}%`} hint="RMSE, all test days" tint="#22c55e" />
        <Stat icon={CheckCircle2} label="Error reduction on rainy days" value={`${Math.round(data.wet_day_rmse_improvement_vs_baseline * 100)}%`} hint="Days with ≥45 mm in the last 3 days" tint="#38bdf8" />
        <Stat icon={Sigma} label={`Best model RMSE (${MODEL_LABEL[data.best_model]})`} value={fmt(data.models[data.best_model].rmse, 3)} hint={`vs ${fmt(data.models.baseline_ward_mean.rmse, 3)} for the baseline`} tint="#a78bfa" />
        <Stat icon={Layers} label="Random Forest" value={`${data.random_forest_params.numTrees} trees`} hint={`depth ${data.random_forest_params.maxDepth} · ${data.features.length} features`} tint="#f97316" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <SectionTitle icon={Sigma} title="Model comparison (hold-out)" subtitle="Lower RMSE / MAE is better; higher R² is better." tint="text-violet-400" />
          <table className="w-full text-xs">
            <thead>
              <tr className="text-white/35 text-left">
                <th className="font-medium pb-2">Model</th>
                <th className="font-medium pb-2 text-right">RMSE</th>
                <th className="font-medium pb-2 text-right">MAE</th>
                <th className="font-medium pb-2 text-right">R²</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.key} className="border-t border-white/[0.05]">
                  <td className="py-2.5 text-white/85">
                    {m.label}
                    {m.key === data.best_model && <span className="ml-2 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">BEST</span>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-white/75">{fmt(m.rmse, 3)}</td>
                  <td className="py-2.5 text-right tabular-nums text-white/75">{fmt(m.mae, 3)}</td>
                  <td className="py-2.5 text-right tabular-nums text-white/75">{fmt(m.r2, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-white/45 mt-3 leading-relaxed">
            Daily counts per ward are small and noisy, so R² stays modest — but both models clearly beat the &quot;same as usual&quot; guess, and the gap is largest on rainy
            days, which is when planning matters.
          </p>
        </Card>

        <Card>
          <SectionTitle icon={Layers} title="What drives the forecast" subtitle="Random Forest feature importance." tint="text-sky-400" />
          <div className="space-y-2.5">
            {data.importance.map((f) => (
              <div key={f.feature}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={f.feature === "rain_d2" ? "text-orange-300 font-semibold" : "text-white/70"}>{FEATURE_LABEL[f.feature] ?? f.feature}</span>
                  <span className="text-white/55 tabular-nums">{fmt(f.importance * 100, 1)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(f.importance / maxImp) * 100}%`, background: f.feature === "rain_d2" ? "#f97316" : "#38bdf8" }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/45 mt-3">
            Rain from <span className="text-orange-300">two days earlier</span> outweighs today&apos;s rain — the model rediscovers the 48-hour lag on its own.
          </p>
        </Card>
      </div>

      <Card>
        <SectionTitle icon={LineIcon} title="Actual vs predicted on held-out weeks" subtitle="Citywide daily incidents. Gaps between weeks are the training weeks." />
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.test} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="calendar_date" {...axis} minTickGap={40} tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} />
            <YAxis {...axis} />
            <Tooltip {...chartTooltip} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line dataKey="actual" name="Actual" stroke={COMPLAINT} strokeWidth={2} dot={false} />
            <Line dataKey="predicted" name="Random Forest" stroke="#a78bfa" strokeWidth={2} dot={false} />
            <Line dataKey="baseline" name="Baseline" stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
        <SourceNote>gold/ml/test_predictions.csv</SourceNote>
      </Card>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <SectionTitle icon={BrainCircuit} title="Scenario response curves" subtitle={`Citywide incidents predicted for a single rain day, N days later (${data.scenario_assumptions}).`} tint="text-violet-400" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.cityScenario} margin={{ top: 5, right: 5, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="rain" {...axis} tickFormatter={(v: number) => `${v} mm`} />
              <YAxis {...axis} />
              <Tooltip {...chartTooltip} labelFormatter={(v) => `${v} mm of rain`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {(["h0", "h1", "h2", "h3"] as const).map((h, i) => (
                <Bar key={h} dataKey={h} name={i === 0 ? "Same day" : `+${i * 24}h`} fill={H_COLORS[i]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle icon={Target} title="Most sensitive wards" subtitle="Predicted incidents 48h after 65 mm of rain vs a dry day." tint="text-orange-400" />
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.wardAt65.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" {...axis} />
              <YAxis type="category" dataKey="name" {...axis} width={130} tick={{ ...axis.tick, fontSize: 10 }} interval={0} />
              <Tooltip {...chartTooltip} formatter={(v) => fmt(Number(v), 2)} />
              <Bar dataKey="dry" name="Dry day" fill="rgba(255,255,255,0.18)" radius={[0, 3, 3, 0]} />
              <Bar dataKey="heavy" name="After 65 mm" radius={[0, 3, 3, 0]}>
                {data.wardAt65.slice(0, 10).map((w) => (
                  <Cell key={w.id} fill={w.tier === "CRITICAL" ? "#f43f5e" : w.tier === "MODERATE" ? "#f59e0b" : "#10b981"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 mt-2">
            <TierPill tier="CRITICAL" />
            <TierPill tier="MODERATE" />
            <TierPill tier="LOW" />
          </div>
        </Card>
      </div>
    </div>
  );
}
