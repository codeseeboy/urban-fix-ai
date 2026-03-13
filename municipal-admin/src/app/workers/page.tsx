"use client";

import { useEffect, useState, useMemo } from "react";
import { issuesAPI } from "@/lib/api";
import { timeAgo, STATUS_COLORS, SEVERITY_COLORS } from "@/lib/utils";
import {
  Users, HardHat, CheckCircle2, Clock, MapPin, TrendingUp,
  AlertTriangle, BarChart3, Award,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function WorkersPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    issuesAPI
      .getFeed({ limit: 500 })
      .then(({ data }) => setIssues(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const assigned = issues.filter((i) => i.status === "InProgress");
    const resolved = issues.filter((i) => i.status === "Resolved");
    const pending = issues.filter((i) => i.status === "Submitted" || i.status === "Acknowledged");

    const deptWorkload: Record<string, { assigned: number; resolved: number; pending: number }> = {};
    issues.forEach((i) => {
      const dept = i.departmentTag || "General";
      if (!deptWorkload[dept]) deptWorkload[dept] = { assigned: 0, resolved: 0, pending: 0 };
      if (i.status === "InProgress") deptWorkload[dept].assigned++;
      else if (i.status === "Resolved") deptWorkload[dept].resolved++;
      else deptWorkload[dept].pending++;
    });

    const deptChart = Object.entries(deptWorkload)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => (b.assigned + b.pending) - (a.assigned + a.pending));

    return { assigned: assigned.length, resolved: resolved.length, pending: pending.length, deptChart, deptWorkload };
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
          <HardHat className="w-5 h-5 text-amber-400" /> Field Worker Management
        </h1>
        <p className="text-xs sm:text-sm text-white/40 mt-0.5">Monitor workload, assignments, and department performance</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {[
          { label: "Active Assignments", value: stats.assigned, icon: Clock, color: "blue" },
          { label: "Pending Queue", value: stats.pending, icon: AlertTriangle, color: "amber" },
          { label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "green" },
          { label: "Departments", value: Object.keys(stats.deptWorkload).length, icon: Users, color: "purple" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <kpi.icon className={`w-5 h-5 text-${kpi.color}-400`} />
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Dept Workload Chart */}
      <div className="glass-card p-3 sm:p-5">
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" /> Department Workload Distribution
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats.deptChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#141420", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="pending" fill="#eab308" name="Pending" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="assigned" fill="#3b82f6" name="In Progress" radius={[0, 0, 0, 0]} stackId="a" />
            <Bar dataKey="resolved" fill="#22c55e" name="Resolved" radius={[4, 4, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Department Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {Object.entries(stats.deptWorkload)
          .sort(([, a], [, b]) => (b.assigned + b.pending) - (a.assigned + a.pending))
          .map(([dept, w]) => {
            const total = w.assigned + w.resolved + w.pending;
            const resRate = total > 0 ? Math.round((w.resolved / total) * 100) : 0;
            return (
              <div key={dept} className="glass-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">{dept}</h3>
                  <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                    {resRate}% resolved
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { label: "Pending", value: w.pending, color: "text-amber-400" },
                    { label: "Active", value: w.assigned, color: "text-blue-400" },
                    { label: "Done", value: w.resolved, color: "text-green-400" },
                  ].map((s) => (
                    <div key={s.label} className="text-center">
                      <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-[10px] text-white/30">{s.label}</p>
                    </div>
                  ))}
                </div>
                <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden flex">
                  {w.pending > 0 && <div className="h-full bg-amber-500" style={{ width: `${(w.pending / total) * 100}%` }} />}
                  {w.assigned > 0 && <div className="h-full bg-blue-500" style={{ width: `${(w.assigned / total) * 100}%` }} />}
                  {w.resolved > 0 && <div className="h-full bg-green-500" style={{ width: `${(w.resolved / total) * 100}%` }} />}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}
