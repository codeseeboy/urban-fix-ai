"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Filter, GitMerge, HardDrive, ImageOff, Radio } from "lucide-react";
import { bdaAPI } from "@/lib/api";
import { axis, bytes, Card, chartTooltip, ErrorBox, fmt, Loading, SectionTitle, SourceNote, useBda } from "@/components/bda/ui";

type Quality = {
  veracity: Record<string, number> | null;
  dedupAudit: { ward_id: string; raw_reports: number; incidents: number; collapse_ratio: number }[];
  cleanComparison: { before_count: number; after_count: number; removed_count: number; kept_ratio: number; removal_reasons: Record<string, number> } | null;
  edaSummary: Record<string, number> | null;
  ingest: {
    historyEvents: number;
    weatherRecords: number;
    kafka: {
      messages: number;
      eventTimeRange: { from: string; to: string };
      topics: { topic: string; messages: number; partitions: { partition: number; messages: number }[] }[];
      categories: { category: string; count: number }[];
    };
  };
  layers: Record<"bronze" | "silver" | "gold", { files: number; bytes: number }>;
};

export default function QualityPage() {
  const { data, error, loading } = useBda<Quality>(() => bdaAPI.quality());
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} />;

  const v = data.veracity ?? {};
  const funnel = [
    { label: "Landed in bronze", value: v.bronze_reports, color: "#eab308", note: "Raw events from Kafka" },
    { label: "Rejected: GPS accuracy too poor", value: -(v.rejected_gps_accuracy ?? 0), color: "#ef4444" },
    { label: "Rejected: outside Mumbai bounding box", value: -(v.rejected_out_of_bbox ?? 0), color: "#ef4444" },
    { label: "Rejected: outside analysis window", value: -(v.rejected_outside_window ?? 0), color: "#ef4444" },
    { label: "Passed veracity checks", value: v.after_veracity, color: "#94a3b8", note: `${fmt(v.quarantined_unknown_ward)} more than 5 km from any ward centroid were quarantined as UNKNOWN_WARD` },
    { label: "Distinct incidents after graph dedup", value: v.distinct_incidents, color: "#22c55e", note: `${fmt(v.duplicate_graph_edges)} duplicate edges → ${fmt(v.reports_per_incident, 2)} reports per incident` },
  ];
  const top = v.bronze_reports || 1;
  const dedup = [...data.dedupAudit].filter((d) => d.ward_id !== "UNKNOWN_WARD").sort((a, b) => b.raw_reports - a.raw_reports);
  const k = data.ingest.kafka;
  const totalLake = data.layers.bronze.bytes + data.layers.silver.bytes + data.layers.gold.bytes;

  return (
    <div className="space-y-4">
      <div className="grid xl:grid-cols-[1.1fr_1fr] gap-4">
        <Card>
          <SectionTitle icon={Filter} title="Veracity funnel" subtitle="What the Spark silver job kept, rejected and merged — every count read from veracity_report.json." tint="text-amber-400" />
          <div className="space-y-3">
            {funnel.map((f) => {
              const val = Math.abs(f.value ?? 0);
              const reject = (f.value ?? 0) < 0;
              return (
                <div key={f.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className={reject ? "text-white/45 pl-4" : "text-white/80 font-medium"}>{reject ? `− ${f.label}` : f.label}</span>
                    <span className="tabular-nums font-semibold" style={{ color: f.color }}>
                      {fmt(val)}
                    </span>
                  </div>
                  <div className={`h-2 rounded-full bg-white/[0.04] overflow-hidden ${reject ? "ml-4" : ""}`}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(0.6, (val / top) * 100)}%`, background: f.color, opacity: reject ? 0.7 : 1 }} />
                  </div>
                  {f.note && <p className="text-[10px] text-white/30 mt-1">{f.note}</p>}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-5 text-center">
            <div className="rounded-lg bg-white/[0.03] py-2.5">
              <p className="text-base font-bold text-white tabular-nums">{fmt(((v.after_veracity ?? 0) / top) * 100, 1)}%</p>
              <p className="text-[10px] text-white/40">kept after veracity</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-2.5">
              <p className="text-base font-bold text-white tabular-nums">
                {fmt(v.department_values_before)} → {fmt(v.department_values_after)}
              </p>
              <p className="text-[10px] text-white/40">department labels normalised</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] py-2.5">
              <p className="text-base font-bold text-emerald-400 tabular-nums">{fmt((1 - (v.distinct_incidents ?? 0) / (v.silver_reports || 1)) * 100, 0)}%</p>
              <p className="text-[10px] text-white/40">fewer work orders</p>
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle icon={GitMerge} title="Deduplication by ward" subtitle="Raw reports vs real incidents. One pothole reported by six people is one job." tint="text-violet-400" />
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={dedup} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" {...axis} />
              <YAxis type="category" dataKey="ward_id" {...axis} width={40} tick={{ ...axis.tick, fontSize: 10 }} interval={0} />
              <Tooltip {...chartTooltip} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="raw_reports" name="Raw reports" fill="#a78bfa" fillOpacity={0.35} radius={[0, 3, 3, 0]} />
              <Bar dataKey="incidents" name="Incidents" fill="#a78bfa" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <SourceNote>gold/analytics/dedup_audit — spatio-temporal duplicate graph, connected components</SourceNote>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <SectionTitle icon={Radio} title="Kafka ingestion" subtitle="Latest captured batch from the broker." tint="text-orange-400" />
          {k.topics.map((t) => (
            <div key={t.topic} className="mb-4">
              <p className="text-[11px] font-mono text-white/70">{t.topic}</p>
              <p className="text-[10px] text-white/35 mb-2">{fmt(t.messages)} messages</p>
              <div className="space-y-1.5">
                {t.partitions.map((p) => (
                  <div key={p.partition} className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 w-14">partition {p.partition}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                      <div className="h-full rounded-full bg-orange-400" style={{ width: `${(p.messages / t.messages) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-white/55 tabular-nums w-10 text-right">{fmt(p.messages)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            {k.categories.map((c) => (
              <span key={c.category} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/55">
                {c.category} · {fmt(c.count)}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-white/30 mt-3">
            Event time {k.eventTimeRange.from?.slice(0, 10)} → {k.eventTimeRange.to?.slice(0, 10)}
          </p>
        </Card>

        <Card>
          <SectionTitle icon={HardDrive} title="Data lake layers" subtitle="Medallion architecture on HDFS / local lake." tint="text-sky-400" />
          <div className="space-y-3">
            {(
              [
                ["bronze", "#eab308", "Raw JSONL as landed from Kafka and the weather API"],
                ["silver", "#94a3b8", "Cleaned, typed, ward-attributed, deduplicated Parquet"],
                ["gold", "#22c55e", "Fused ward × date marts, vulnerability index, audits"],
              ] as const
            ).map(([name, color, desc]) => (
              <div key={name} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold capitalize" style={{ color }}>
                    {name}
                  </span>
                  <span className="text-[11px] text-white/60 tabular-nums">
                    {data.layers[name].files} files · {bytes(data.layers[name].bytes)}
                  </span>
                </div>
                <div className="h-1.5 mt-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(data.layers[name].bytes / totalLake) * 100}%`, background: color }} />
                </div>
                <p className="text-[10px] text-white/35 mt-1.5">{desc}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/30 mt-3">
            Inputs: {fmt(data.ingest.historyEvents)} report events · {fmt(data.ingest.weatherRecords)} rainfall records
          </p>
        </Card>

        <Card>
          <SectionTitle icon={ImageOff} title="Image dataset cleaning" subtitle="Spark job over the road-damage photo metadata." tint="text-rose-400" />
          {data.cleanComparison ? (
            <>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-white tabular-nums">{fmt(data.cleanComparison.after_count)}</p>
                <p className="text-xs text-white/40 pb-1">of {fmt(data.cleanComparison.before_count)} images kept ({fmt(data.cleanComparison.kept_ratio * 100, 0)}%)</p>
              </div>
              <div className="space-y-2 mt-4">
                {Object.entries(data.cleanComparison.removal_reasons)
                  .filter(([key]) => key !== "total_removed")
                  .map(([key, n]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[11px] text-white/55 flex-1 capitalize">{key.replace(/_/g, " ")}</span>
                      <div className="w-24 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                        <div className="h-full rounded-full bg-rose-400" style={{ width: `${(n / (data.cleanComparison!.removed_count || 1)) * 100}%` }} />
                      </div>
                      <span className="text-[11px] text-white/70 tabular-nums w-5 text-right">{n}</span>
                    </div>
                  ))}
              </div>
              {data.edaSummary && (
                <p className="text-[10px] text-white/30 mt-4">
                  EDA: {fmt(data.edaSummary.labeled_images)} labelled · {fmt(data.edaSummary.duplicate_groups)} duplicate groups · pothole class share{" "}
                  {fmt(data.edaSummary.class_imbalance_pothole_ratio * 100, 1)}%
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-white/40">No image cleaning output found.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
