"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Building2, Clock, Crosshair, Layers, Siren, UserX } from "lucide-react";
import { bdaAPI } from "@/lib/api";
import { axis, Card, chartTooltip, ErrorBox, fmt, Loading, SectionTitle, SourceNote, Stat, useBda } from "@/components/bda/ui";

type Patterns = {
  total: number;
  emergencyShare: number;
  anonymousShare: number;
  heatmap: { days: string[]; matrix: number[][] };
  departmentMonth: { months: string[]; rows: { dept: string; total: number; values: number[] }[] };
  categories: { name: string; count: number; severity: Record<string, number> }[];
  status: { name: string; count: number }[];
  source: { name: string; count: number }[];
  accuracy: { label: string; count: number }[];
  updatedAt: string;
};

const SEV = [
  { key: "Critical", color: "#ef4444" },
  { key: "High", color: "#f97316" },
  { key: "Medium", color: "#facc15" },
  { key: "Low", color: "#22c55e" },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function PatternsPage() {
  const { data, error, loading } = useBda<Patterns>(() => bdaAPI.patterns());
  if (loading) return <Loading label="Scanning the bronze event history…" />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} />;

  const heatMax = Math.max(...data.heatmap.matrix.flat());
  const hourTotals = Array.from({ length: 24 }, (_, h) => data.heatmap.matrix.reduce((s, row) => s + row[h], 0));
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  const dayTotals = data.heatmap.matrix.map((r) => r.reduce((a, b) => a + b, 0));
  const peakDay = data.heatmap.days[dayTotals.indexOf(Math.max(...dayTotals))];
  const dmMax = Math.max(...data.departmentMonth.rows.flatMap((r) => r.values));
  const goodGps = data.accuracy.slice(0, 3).reduce((s, a) => s + a.count, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={Clock} label="Busiest reporting hour" value={`${String(peakHour).padStart(2, "0")}:00`} hint={`Busiest day: ${peakDay}`} tint="#38bdf8" />
        <Stat icon={Siren} label="Flagged as emergency" value={`${fmt(data.emergencyShare * 100, 1)}%`} hint={`of ${fmt(data.total)} events`} tint="#ef4444" />
        <Stat icon={UserX} label="Reported anonymously" value={`${fmt(data.anonymousShare * 100, 1)}%`} tint="#a78bfa" />
        <Stat icon={Crosshair} label="GPS fix within 20 m" value={`${fmt((goodGps / data.total) * 100, 1)}%`} hint="Usable for exact dispatch" tint="#22c55e" />
      </div>

      <Card>
        <SectionTitle icon={Clock} title="When citizens report" subtitle="Events by weekday × hour of day. Staff the triage desk to match." />
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: "40px repeat(24, minmax(0, 1fr))" }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="text-[9px] text-white/30 text-center">
                  {h % 3 === 0 ? h : ""}
                </div>
              ))}
              {data.heatmap.days.map((day, di) => (
                <>
                  <div key={`${day}-l`} className="text-[10px] text-white/45 flex items-center">
                    {day}
                  </div>
                  {data.heatmap.matrix[di].map((v, h) => (
                    <div
                      key={`${day}-${h}`}
                      title={`${day} ${String(h).padStart(2, "0")}:00 — ${v} events`}
                      className="h-6 rounded-[4px]"
                      style={{ background: `rgba(56,189,248,${0.04 + (v / heatMax) * 0.86})` }}
                    />
                  ))}
                </>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={Building2} title="Department load through the year" subtitle="Monthly events per department — where the monsoon hits hardest." tint="text-amber-400" />
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] min-w-[640px]">
            <thead>
              <tr className="text-white/35">
                <th className="text-left font-medium pb-2 pr-2">Department</th>
                {data.departmentMonth.months.map((m) => (
                  <th key={m} className="font-medium pb-2 text-center">
                    {MONTHS[Number(m.slice(5)) - 1]}
                  </th>
                ))}
                <th className="font-medium pb-2 text-right pl-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.departmentMonth.rows.map((r) => (
                <tr key={r.dept}>
                  <td className="py-0.5 pr-2 text-white/75 whitespace-nowrap">{r.dept}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className="p-0.5">
                      <div
                        className="rounded text-center py-1 tabular-nums"
                        style={{ background: `rgba(249,115,22,${0.05 + (v / dmMax) * 0.8})`, color: v / dmMax > 0.45 ? "#fff" : "rgba(255,255,255,0.55)" }}
                      >
                        {v}
                      </div>
                    </td>
                  ))}
                  <td className="py-0.5 pl-2 text-right text-white/80 font-semibold tabular-nums">{fmt(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4">
        <Card>
          <SectionTitle icon={Layers} title="Categories and severity mix" subtitle="AI-assigned severity within each category." tint="text-violet-400" />
          <div className="space-y-3">
            {data.categories.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/80 capitalize">{c.name}</span>
                  <span className="text-white/50 tabular-nums">{fmt(c.count)}</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden flex bg-white/[0.04]" style={{ width: `${(c.count / data.categories[0].count) * 100}%` }}>
                  {SEV.map((s) => {
                    const n = c.severity?.[s.key] ?? 0;
                    return n ? <div key={s.key} title={`${s.key}: ${n}`} style={{ width: `${(n / c.count) * 100}%`, background: s.color }} /> : null;
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            {SEV.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[10px] text-white/50">
                <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} /> {s.key}
              </span>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <SectionTitle icon={Crosshair} title="GPS accuracy of reports" subtitle="Reports worse than 100 m are rejected by the veracity gate." tint="text-emerald-400" />
            <ResponsiveContainer width="100%" height={170}>
              <BarChart data={data.accuracy} margin={{ top: 5, right: 5, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="label" {...axis} tick={{ ...axis.tick, fontSize: 10 }} />
                <YAxis {...axis} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="count" name="Reports" radius={[4, 4, 0, 0]}>
                  {data.accuracy.map((a, i) => (
                    <Cell key={a.label} fill={i < 3 ? "#22c55e" : i < 5 ? "#facc15" : "#ef4444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <SectionTitle icon={Layers} title="Lifecycle status" tint="text-sky-400" />
            <div className="space-y-2">
              {data.status.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-white/65">{s.name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                    <div className="h-full rounded-full bg-sky-400" style={{ width: `${(s.count / data.total) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right text-white/55 tabular-nums">{fmt((s.count / data.total) * 100, 1)}%</span>
                </div>
              ))}
            </div>
            <SourceNote>bronze/events/civic_history.jsonl · {fmt(data.total)} events</SourceNote>
          </Card>
        </div>
      </div>
    </div>
  );
}
