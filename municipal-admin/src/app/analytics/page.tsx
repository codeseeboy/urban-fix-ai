"use client";

import { useEffect, useState, useMemo } from "react";
import { issuesAPI, gamificationAPI } from "@/lib/api";
import { SEVERITY_COLORS, STATUS_COLORS, DEPARTMENTS } from "@/lib/utils";
import {
  BarChart3, TrendingUp, PieChart as PieChartIcon, Activity,
  Target, Award, Zap, MapPin, AlertTriangle, CheckCircle2,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line,
} from "recharts";

export default function AnalyticsPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    issuesAPI
      .getFeed({ limit: 1000 })
      .then(({ data }) => setIssues(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const analytics = useMemo(() => {
    const total = issues.length;
    const resolved = issues.filter((i) => i.status === "Resolved").length;
    const resRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const avgPriority = total > 0 ? Math.round(issues.reduce((s, i) => s + (i.priorityScore || 0), 0) / total) : 0;

    const bySeverity = ["Critical", "High", "Medium", "Low"].map((sev) => ({
      name: sev,
      value: issues.filter((i) => i.aiSeverity === sev).length,
      color: SEVERITY_COLORS[sev],
    }));

    const byStatus = ["Submitted", "Acknowledged", "InProgress", "Resolved", "Rejected"].map((s) => ({
      name: s,
      value: issues.filter((i) => i.status === s).length,
      color: STATUS_COLORS[s],
    }));

    const byCategory: Record<string, number> = {};
    issues.forEach((i) => {
      const cat = i.category || "Other";
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    });
    const categoryData = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    const byDept: Record<string, { total: number; resolved: number }> = {};
    issues.forEach((i) => {
      const dept = i.departmentTag || "General";
      if (!byDept[dept]) byDept[dept] = { total: 0, resolved: 0 };
      byDept[dept].total++;
      if (i.status === "Resolved") byDept[dept].resolved++;
    });
    const deptPerformance = Object.entries(byDept).map(([name, v]) => ({
      name,
      total: v.total,
      resolved: v.resolved,
      rate: v.total > 0 ? Math.round((v.resolved / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);

    const radarData = deptPerformance.slice(0, 6).map((d) => ({
      department: d.name,
      issues: d.total,
      resolved: d.resolved,
      rate: d.rate,
    }));

    const last30 = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const dayStr = d.toISOString().slice(0, 10);
      const dayIssues = issues.filter((issue) => issue.createdAt?.slice(0, 10) === dayStr);
      return {
        date: d.toLocaleDateString("en", { day: "numeric", month: "short" }),
        reported: dayIssues.length,
        resolved: dayIssues.filter((issue) => issue.status === "Resolved").length,
      };
    });

    const emergencyCount = issues.filter((i) => i.emergency).length;
    const avgUpvotes = total > 0 ? Math.round(issues.reduce((s, i) => s + (i.upvotes?.length || 0), 0) / total) : 0;

    return {
      total, resolved, resRate, avgPriority, bySeverity, byStatus,
      categoryData, deptPerformance, radarData, last30,
      emergencyCount, avgUpvotes,
    };
  }, [issues]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-blue-400" /> Analytics & Reports
        </h1>
        <p className="text-xs sm:text-sm text-white/40 mt-0.5">Comprehensive data insights and performance metrics</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: "Total Issues", value: analytics.total, icon: AlertTriangle, color: "blue" },
          { label: "Resolved", value: analytics.resolved, icon: CheckCircle2, color: "green" },
          { label: "Resolution Rate", value: `${analytics.resRate}%`, icon: Target, color: "emerald" },
          { label: "Avg Priority", value: analytics.avgPriority, icon: Zap, color: "amber" },
          { label: "Emergencies", value: analytics.emergencyCount, icon: Activity, color: "red" },
          { label: "Avg Upvotes", value: analytics.avgUpvotes, icon: Award, color: "purple" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <s.icon className={`w-4 h-4 text-${s.color}-400 mb-2`} />
            <p className="text-xl font-bold text-white">{s.value}</p>
            <p className="text-[10px] text-white/35 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 30-day Trend */}
      <div className="glass-card p-3 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-400" /> 30-Day Trend
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={analytics.last30}>
            <defs>
              <linearGradient id="aRep" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="aRes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.25)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
            <Area type="monotone" dataKey="reported" stroke="#3b82f6" fill="url(#aRep)" strokeWidth={2} name="Reported" />
            <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="url(#aRes)" strokeWidth={2} name="Resolved" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Severity Distribution */}
        <div className="glass-card p-3 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Severity Distribution</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={analytics.bySeverity} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                {analytics.bySeverity.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {analytics.bySeverity.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] text-white/50">{s.name} ({s.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="glass-card p-3 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={analytics.byStatus.filter((s) => s.value > 0)} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                {analytics.byStatus.filter((s) => s.value > 0).map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {analytics.byStatus.filter((s) => s.value > 0).map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] text-white/50">{s.name} ({s.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="glass-card p-3 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Top Categories</h2>
          <div className="space-y-2.5">
            {analytics.categoryData.map((c, i) => {
              const pct = analytics.total > 0 ? (c.value / analytics.total) * 100 : 0;
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/60 capitalize">{c.name}</span>
                    <span className="text-white/40">{c.value} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Dept Performance Table */}
      <div className="glass-card p-3 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Department Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="text-[11px] text-white/30 border-b border-white/[0.06]">
                <th className="pb-3 font-medium">Department</th>
                <th className="pb-3 font-medium">Total Issues</th>
                <th className="pb-3 font-medium">Resolved</th>
                <th className="pb-3 font-medium">Resolution Rate</th>
                <th className="pb-3 font-medium">Performance</th>
              </tr>
            </thead>
            <tbody>
              {analytics.deptPerformance.map((d) => (
                <tr key={d.name} className="border-b border-white/[0.03]">
                  <td className="py-3 text-xs font-medium text-white/80">{d.name}</td>
                  <td className="py-3 text-xs text-white/50">{d.total}</td>
                  <td className="py-3 text-xs text-green-400">{d.resolved}</td>
                  <td className="py-3 text-xs text-white/70 font-semibold">{d.rate}%</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${d.rate}%`, background: d.rate >= 70 ? "#22c55e" : d.rate >= 40 ? "#eab308" : "#ef4444" }} />
                      </div>
                      <span className="text-[10px]" style={{ color: d.rate >= 70 ? "#22c55e" : d.rate >= 40 ? "#eab308" : "#ef4444" }}>
                        {d.rate >= 70 ? "Good" : d.rate >= 40 ? "Fair" : "Low"}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

