"use client";

import Link from "next/link";
import {
  ArrowRight, CloudRain, Database, Flame, Gauge, GitMerge, Layers, Map, Radio, ShieldCheck, Sparkles, Timer, Workflow, Zap,
} from "lucide-react";
import { bdaAPI } from "@/lib/api";
import { bytes, Card, ErrorBox, fmt, Loading, SectionTitle, Stat, TierPill, useBda } from "@/components/bda/ui";

type Overview = {
  dateRange: { from: string; to: string; days: number };
  thresholds: { heavyMm: number; dryMm: number };
  lag: Record<string, number>;
  builtAt: string;
  files: { fused: { rows: number; updatedAt: string } };
  layers: Record<"bronze" | "silver" | "gold", { files: number; bytes: number }>;
  ingest: {
    historyEvents: number;
    weatherRecords: number;
    kafka: { messages: number; topics: { topic: string; messages: number; partitions: { partition: number; messages: number }[] }[] };
  };
  veracity: Record<string, number> | null;
  headline: {
    wards: number;
    criticalWards: { id: string; name: string; cvi: number }[];
    peakLagHours: number;
    peakSurge: number;
    rawReports: number;
    incidents: number;
    dispatchSaved: number | null;
    heavyRainEpisodes: number;
  };
  provenance: Record<string, string>;
};

function Stage({ icon: Icon, tint, title, tech, lines }: { icon: typeof Radio; tint: string; title: string; tech: string; lines: string[] }) {
  return (
    <div className="relative flex-1 min-w-[170px] rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${tint}22` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: tint }} />
        </div>
        <div>
          <p className="text-xs font-semibold text-white leading-tight">{title}</p>
          <p className="text-[10px] text-white/35">{tech}</p>
        </div>
      </div>
      <ul className="space-y-1">
        {lines.map((l) => (
          <li key={l} className="text-[11px] text-white/55 leading-snug">{l}</li>
        ))}
      </ul>
    </div>
  );
}

const Arrow = () => (
  <div className="hidden xl:flex items-center text-white/20">
    <ArrowRight className="w-4 h-4" />
  </div>
);

export default function BdaOverview() {
  const { data, error, loading } = useBda<Overview>(() => bdaAPI.overview());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} />;

  const h = data.headline;
  const v = data.veracity ?? {};
  const k = data.ingest.kafka;
  const lagBars = [24, 48, 72].map((l) => ({ l, v: data.lag[`${l}h`] ?? 0 }));
  const maxLag = Math.max(...lagBars.map((b) => b.v));

  return (
    <div className="space-y-5">
      {/* Headline finding */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-500/[0.08] via-indigo-500/[0.05] to-transparent p-5 sm:p-6">
        <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1fr_auto] gap-6 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/20 px-2 py-1 rounded-full">
              <Sparkles className="w-3 h-3" /> Key finding · recovered by Spark
            </span>
            <h2 className="text-xl sm:text-3xl font-bold text-white mt-3 leading-tight">
              Complaints surge <span className="text-orange-400">{fmt(h.peakSurge, 1)}×</span> about{" "}
              <span className="text-sky-300">{h.peakLagHours} hours</span> after heavy rain.
            </h2>
            <p className="text-sm text-white/50 mt-2 max-w-2xl">
              Measured over {fmt(data.dateRange.days)} days ({data.dateRange.from} → {data.dateRange.to}) across {h.wards} wards. A day counts as heavy
              rain above {data.thresholds.heavyMm} mm; the baseline is dry days below {data.thresholds.dryMm} mm.
            </p>
          </div>
          <div className="flex items-end gap-3 h-28">
            {lagBars.map((b) => (
              <div key={b.l} className="flex flex-col items-center gap-1.5">
                <span className={`text-xs font-bold tabular-nums ${b.l === h.peakLagHours ? "text-orange-400" : "text-white/50"}`}>{fmt(b.v, 1)}×</span>
                <div
                  className={`w-10 rounded-t-md ${b.l === h.peakLagHours ? "bg-gradient-to-t from-orange-600 to-orange-400" : "bg-white/10"}`}
                  style={{ height: `${(b.v / maxLag) * 72}px` }}
                />
                <span className="text-[10px] text-white/40">+{b.l}h</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat icon={Timer} label="Peak response lag" value={`${h.peakLagHours} h`} hint="When crews should be ready after a downpour" tint="#38bdf8" />
        <Stat icon={Flame} label="Critical-risk wards" value={h.criticalWards.length} hint={`of ${h.wards} BMC wards (top CVI quartile)`} tint="#f43f5e" />
        <Stat
          icon={GitMerge}
          label="Crew dispatches saved by dedup"
          value={h.dispatchSaved !== null ? `${Math.round(h.dispatchSaved * 100)}%` : "—"}
          hint={`${fmt(h.rawReports)} reports → ${fmt(h.incidents)} real incidents`}
          tint="#a78bfa"
        />
        <Stat icon={CloudRain} label="Heavy-rain episodes" value={h.heavyRainEpisodes} hint={`Days with ≥ ${data.thresholds.heavyMm} mm in at least one ward`} tint="#22d3ee" />
      </div>

      {/* Pipeline */}
      <Card>
        <SectionTitle
          icon={Workflow}
          title="Pipeline architecture"
          subtitle="Each figure on this page is read from a layer of the lake, not hard-coded."
          right={<span className="text-[10px] text-white/30 whitespace-nowrap">Gold refreshed {new Date(data.files.fused.updatedAt).toLocaleString()}</span>}
        />
        <div className="flex flex-col xl:flex-row gap-2 xl:items-stretch">
          <Stage
            icon={Radio}
            tint="#f59e0b"
            title="Sources"
            tech="App events · Open-Meteo API"
            lines={[`${fmt(data.ingest.historyEvents)} civic report events`, `${fmt(data.ingest.weatherRecords)} daily rainfall records`, "24 BMC ward reference rows"]}
          />
          <Arrow />
          <Stage
            icon={Zap}
            tint="#f97316"
            title="Apache Kafka"
            tech={`${k.topics.length} topic(s) · ${k.topics[0]?.partitions.length ?? 0} partitions`}
            lines={[
              `${fmt(k.messages)} messages in latest batch`,
              ...k.topics.flatMap((t) => t.partitions.map((p) => `${t.topic.split(".").slice(-2).join(".")} · p${p.partition}: ${fmt(p.messages)}`)),
            ]}
          />
          <Arrow />
          <Stage
            icon={Database}
            tint="#eab308"
            title="Bronze (HDFS / lake)"
            tech="Raw, as landed"
            lines={[`${data.layers.bronze.files} files · ${bytes(data.layers.bronze.bytes)}`, "JSONL events + weather", "Image metadata (Parquet)"]}
          />
          <Arrow />
          <Stage
            icon={ShieldCheck}
            tint="#94a3b8"
            title="Silver · Spark"
            tech="Clean · align · veracity · dedup"
            lines={[`${data.layers.silver.files} files · ${bytes(data.layers.silver.bytes)}`, `${fmt(v.after_veracity)} passed veracity`, `${fmt(v.distinct_incidents)} incidents after graph dedup`]}
          />
          <Arrow />
          <Stage
            icon={Layers}
            tint="#22c55e"
            title="Gold · Spark fusion"
            tech="ward × date marts"
            lines={[`${data.layers.gold.files} files · ${bytes(data.layers.gold.bytes)}`, `${fmt(data.files.fused.rows)} ward-day fused rows`, "Lag surge · CVI ranking"]}
          />
          <Arrow />
          <Stage icon={Gauge} tint="#38bdf8" title="Serving" tech="Express API → this dashboard" lines={["Ward risk & planner", "Rain × complaint fusion", "Data-quality audit"]} />
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-4">
        {/* Use cases */}
        <Card>
          <SectionTitle icon={Sparkles} title="What the municipality can do with it" tint="text-violet-400" />
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              {
                href: "/bda/planner",
                icon: Gauge,
                tint: "#f97316",
                title: "Pre-position crews before the surge",
                body: `Enter tomorrow's rain forecast and see expected incidents per ward ${h.peakLagHours}h later, from observed history.`,
              },
              {
                href: "/bda/wards",
                icon: Map,
                tint: "#f43f5e",
                title: "Prioritise drainage investment",
                body: "The Civic Vulnerability Index ranks wards by surge, recurrence and drainage deficit.",
              },
              {
                href: "/bda/quality",
                icon: GitMerge,
                tint: "#a78bfa",
                title: "Stop duplicate dispatches",
                body: `Graph-based dedup collapses ${fmt(v.reports_per_incident, 1)} reports per incident into one work order.`,
              },
              {
                href: "/bda/fusion",
                icon: CloudRain,
                tint: "#38bdf8",
                title: "Plan for the monsoon season",
                body: "Monthly rain and complaint curves show when backlogs build up across the year.",
              },
            ].map((u) => (
              <Link key={u.href} href={u.href} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] p-4 transition">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${u.tint}1f` }}>
                  <u.icon className="w-4 h-4" style={{ color: u.tint }} />
                </div>
                <p className="text-sm font-semibold text-white">{u.title}</p>
                <p className="text-[11px] text-white/45 mt-1 leading-relaxed">{u.body}</p>
                <p className="text-[11px] text-sky-400 mt-2 flex items-center gap-1 opacity-70 group-hover:opacity-100">
                  Open <ArrowRight className="w-3 h-3" />
                </p>
              </Link>
            ))}
          </div>
        </Card>

        {/* Critical wards + provenance */}
        <div className="space-y-4">
          <Card>
            <SectionTitle icon={Flame} title="Critical wards" subtitle="Highest Civic Vulnerability Index" tint="text-rose-400" />
            <div className="space-y-2">
              {h.criticalWards.map((w, i) => (
                <Link key={w.id} href="/bda/wards" className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]">
                  <span className="w-5 text-[11px] text-white/30 tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{w.name}</p>
                    <div className="h-1 mt-1 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-rose-600 to-rose-400" style={{ width: `${w.cvi * 100}%` }} />
                    </div>
                  </div>
                  <span className="text-[11px] text-white/60 tabular-nums">{fmt(w.cvi, 2)}</span>
                  <TierPill tier="CRITICAL" />
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <SectionTitle icon={ShieldCheck} title="Data provenance" tint="text-emerald-400" />
            <ul className="space-y-2.5">
              {Object.entries(data.provenance).map(([k2, text]) => (
                <li key={k2} className="flex gap-2.5">
                  <span
                    className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${text.startsWith("Real") ? "bg-emerald-400" : "bg-amber-400"}`}
                  />
                  <p className="text-[11px] text-white/55 leading-relaxed">
                    <span className="text-white/80 font-medium capitalize">{k2}: </span>
                    {text}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
