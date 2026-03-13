"use client";

import { useEffect, useState, useMemo } from "react";
import { issuesAPI, gamificationAPI, notificationsAPI } from "@/lib/api";
import { formatNumber, timeAgo, SEVERITY_COLORS, STATUS_COLORS } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp, Users, BarChart3,
  ArrowUpRight, ArrowDownRight, Eye, MapPin, Flame, Activity,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import Link from "next/link";

interface Issue {
  _id: string;
  title: string;
  status: string;
  aiSeverity: string;
  category: string;
  createdAt: string;
  departmentTag: string;
  upvotes?: string[];
  location?: { address?: string };
  priorityScore?: number;
  emergency?: boolean;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      issuesAPI.getFeed({ limit: 200 }),
      gamificationAPI.getStats(),
    ])
      .then(([feedRes, statsRes]) => {
        setIssues(Array.isArray(feedRes.data) ? feedRes.data : []);
        setStats(statsRes.data || {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const computed = useMemo(() => {
    const submitted = issues.filter((i) => i.status === "Submitted").length;
    const inProgress = issues.filter((i) => i.status === "InProgress").length;
    const resolved = issues.filter((i) => i.status === "Resolved").length;
    const critical = issues.filter((i) => i.aiSeverity === "Critical").length;
    const high = issues.filter((i) => i.aiSeverity === "High").length;
    const emergencies = issues.filter((i) => i.emergency).length;

    const resolutionRate = issues.length > 0 ? Math.round((resolved / issues.length) * 100) : 0;

    const byStatus = [
      { name: "Submitted", value: submitted, color: STATUS_COLORS.Submitted },
      { name: "In Progress", value: inProgress, color: STATUS_COLORS.InProgress },
      { name: "Resolved", value: resolved, color: STATUS_COLORS.Resolved },
    ];

    const bySeverity = [
      { name: "Critical", value: critical, color: SEVERITY_COLORS.Critical },
      { name: "High", value: high, color: SEVERITY_COLORS.High },
      { name: "Medium", value: issues.filter((i) => i.aiSeverity === "Medium").length, color: SEVERITY_COLORS.Medium },
      { name: "Low", value: issues.filter((i) => i.aiSeverity === "Low").length, color: SEVERITY_COLORS.Low },
    ];

    const deptMap: Record<string, number> = {};
    issues.forEach((i) => {
      const dept = i.departmentTag || "General";
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    const byDept = Object.entries(deptMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const label = d.toLocaleDateString("en", { weekday: "short" });
      const dayStr = d.toISOString().slice(0, 10);
      const dayIssues = issues.filter((issue) => issue.createdAt?.slice(0, 10) === dayStr);
      return {
        name: label,
        reported: dayIssues.length,
        resolved: dayIssues.filter((issue) => issue.status === "Resolved").length,
      };
    });

    const recentCritical = issues
      .filter((i) => i.aiSeverity === "Critical" || i.emergency)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    const recentIssues = [...issues]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);

    return {
      total: issues.length, submitted, inProgress, resolved, critical, emergencies,
      resolutionRate, byStatus, bySeverity, byDept, last7, recentCritical, recentIssues,
    };
  }, [issues]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: "Total Issues", value: computed.total, icon: AlertTriangle, color: "blue", change: "+12%", up: true },
    { label: "Pending", value: computed.submitted, icon: Clock, color: "amber", change: `${computed.submitted} new`, up: true },
    { label: "In Progress", value: computed.inProgress, icon: Activity, color: "purple", change: "Active", up: true },
    { label: "Resolved", value: computed.resolved, icon: CheckCircle2, color: "green", change: `${computed.resolutionRate}%`, up: true },
    { label: "Critical", value: computed.critical, icon: Flame, color: "red", change: "Urgent", up: false },
    { label: "Emergencies", value: computed.emergencies, icon: AlertTriangle, color: "red", change: "Active", up: false },
  ];

  const colorMap: Record<string, string> = {
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/20 text-blue-400",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/20 text-amber-400",
    purple: "from-purple-500/20 to-purple-500/5 border-purple-500/20 text-purple-400",
    green: "from-green-500/20 to-green-500/5 border-green-500/20 text-green-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/20 text-red-400",
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">
            Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"},{" "}
            {user?.name?.split(" ")[0] || "Admin"}
          </h1>
          <p className="text-xs sm:text-sm text-white/40 mt-1">Here&apos;s what&apos;s happening in your city today</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-medium flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            System Online
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className={`glass-card p-4 bg-gradient-to-br ${colorMap[kpi.color]} stat-glow animate-slide-up`}
          >
            <div className="flex items-center justify-between mb-3">
              <kpi.icon className="w-5 h-5 opacity-80" />
              <span className="text-[10px] font-semibold flex items-center gap-0.5 opacity-70">
                {kpi.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {kpi.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-white">{formatNumber(kpi.value)}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Trend Chart */}
        <div className="glass-card p-3 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Issue Trends — Last 7 Days</h2>
            <TrendingUp className="w-4 h-4 text-white/30" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={computed.last7}>
              <defs>
                <linearGradient id="gReported" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: "rgba(255,255,255,0.6)" }}
              />
              <Area type="monotone" dataKey="reported" stroke="#3b82f6" fill="url(#gReported)" strokeWidth={2} name="Reported" />
              <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="url(#gResolved)" strokeWidth={2} name="Resolved" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status Pie */}
        <div className="glass-card p-3 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Issue Status Distribution</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={computed.byStatus}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {computed.byStatus.map((e, i) => (
                  <Cell key={i} fill={e.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-2">
            {computed.byStatus.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <span className="text-[10px] text-white/50">{s.name} ({s.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Second Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Department Breakdown */}
        <div className="glass-card p-3 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-4">By Department</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={computed.byDept} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={14} name="Issues" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Breakdown */}
        <div className="glass-card p-3 sm:p-5">
          <h2 className="text-sm font-semibold text-white mb-4">By Severity</h2>
          <div className="space-y-3">
            {computed.bySeverity.map((s) => {
              const pct = computed.total > 0 ? (s.value / computed.total) * 100 : 0;
              return (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/60">{s.name}</span>
                    <span className="font-semibold" style={{ color: s.color }}>{s.value}</span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-white/[0.06]">
            <h3 className="text-xs font-semibold text-white/60 mb-2">Resolution Rate</h3>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-green-400">{computed.resolutionRate}%</span>
              <span className="text-xs text-white/30 mb-1">of all issues</span>
            </div>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="glass-card p-3 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">Critical Alerts</h2>
            <Flame className="w-4 h-4 text-red-400" />
          </div>
          {computed.recentCritical.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="w-10 h-10 text-green-400/30 mx-auto mb-2" />
              <p className="text-sm text-white/30">No critical issues</p>
            </div>
          ) : (
            <div className="space-y-2">
              {computed.recentCritical.map((issue) => (
                <Link
                  key={issue._id}
                  href={`/issues/${issue._id}`}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-white/[0.03] transition group"
                >
                  <div
                    className="w-2 h-2 rounded-full mt-1.5 shrink-0 animate-pulse"
                    style={{ background: issue.emergency ? "#ef4444" : SEVERITY_COLORS[issue.aiSeverity] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80 truncate group-hover:text-white">{issue.title}</p>
                    <p className="text-[10px] text-white/30 mt-0.5">
                      {issue.location?.address?.slice(0, 40) || "Unknown"} &middot; {timeAgo(issue.createdAt)}
                    </p>
                  </div>
                  {issue.emergency && (
                    <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">SOS</span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Issues */}
      <div className="glass-card p-3 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Recent Issues</h2>
          <Link href="/issues" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
            View All <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] text-white/30 border-b border-white/[0.06]">
                <th className="pb-3 font-medium">Issue</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Severity</th>
                <th className="pb-3 font-medium">Department</th>
                <th className="pb-3 font-medium">Upvotes</th>
                <th className="pb-3 font-medium">Reported</th>
              </tr>
            </thead>
            <tbody>
              {computed.recentIssues.map((issue) => (
                <tr key={issue._id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition group">
                  <td className="py-3 pr-4">
                    <Link href={`/issues/${issue._id}`} className="text-xs font-medium text-white/80 group-hover:text-blue-400 transition line-clamp-1">
                      {issue.title}
                    </Link>
                    <p className="text-[10px] text-white/25 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {issue.location?.address?.slice(0, 35) || "—"}
                    </p>
                  </td>
                  <td className="py-3">
                    <span
                      className="text-[10px] font-semibold px-2 py-1 rounded-md"
                      style={{
                        color: STATUS_COLORS[issue.status] || "#888",
                        background: (STATUS_COLORS[issue.status] || "#888") + "18",
                      }}
                    >
                      {issue.status}
                    </span>
                  </td>
                  <td className="py-3">
                    <span
                      className="text-[10px] font-semibold px-2 py-1 rounded-md"
                      style={{
                        color: SEVERITY_COLORS[issue.aiSeverity] || "#888",
                        background: (SEVERITY_COLORS[issue.aiSeverity] || "#888") + "18",
                      }}
                    >
                      {issue.aiSeverity}
                    </span>
                  </td>
                  <td className="py-3 text-xs text-white/50">{issue.departmentTag || "—"}</td>
                  <td className="py-3 text-xs text-white/50">{issue.upvotes?.length || 0}</td>
                  <td className="py-3 text-[11px] text-white/30">{timeAgo(issue.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
