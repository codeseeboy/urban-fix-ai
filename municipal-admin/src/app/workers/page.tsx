"use client";

import { useEffect, useState, useMemo } from "react";
import { issuesAPI, usersAPI } from "@/lib/api";
import { timeAgo, DEPARTMENTS } from "@/lib/utils";
import {
  Users, HardHat, CheckCircle2, Clock, MapPin, TrendingUp,
  AlertTriangle, BarChart3, UserPlus, X,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function WorkersPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", department: DEPARTMENTS[0] as string });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const loadWorkers = () =>
    usersAPI.getWorkers().then(({ data }) => setWorkers(Array.isArray(data) ? data : [])).catch(() => setWorkers([]));

  useEffect(() => {
    Promise.all([
      issuesAPI.getFeed({ limit: 500 }).then(({ data }) => setIssues(Array.isArray(data) ? data : [])),
      loadWorkers(),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const addWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      await usersAPI.createStaff({ ...form, role: "field_worker" });
      setForm({ name: "", email: "", password: "", department: DEPARTMENTS[0] as string });
      setShowAdd(false);
      await loadWorkers();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Could not create worker");
    }
    setSaving(false);
  };

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
          { label: "Field Workers", value: workers.length, icon: Users, color: "text-purple-400" },
          { label: "In Progress", value: stats.assigned, icon: Clock, color: "text-blue-400" },
          { label: "Pending Queue", value: stats.pending, icon: AlertTriangle, color: "text-amber-400" },
          { label: "Resolved", value: stats.resolved, icon: CheckCircle2, color: "text-green-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <p className="text-2xl font-bold text-white">{kpi.value}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Worker roster */}
      <div className="glass-card p-3 sm:p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <HardHat className="w-4 h-4 text-amber-400" /> Field Workers
          </h2>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="h-8 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 transition"
          >
            {showAdd ? <X className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />} {showAdd ? "Cancel" : "Add worker"}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={addWorker} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
            <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/80 placeholder-white/25 focus:outline-none" />
            <input required type="email" placeholder="Email (login)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/80 placeholder-white/25 focus:outline-none" />
            <input required type="password" minLength={8} placeholder="Temporary password (8+)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/80 placeholder-white/25 focus:outline-none" />
            <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
              className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none">
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button disabled={saving} className="h-9 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-semibold transition disabled:opacity-40">
              {saving ? "Creating..." : "Create account"}
            </button>
            {formError && <p className="text-[11px] text-red-400 sm:col-span-2 lg:col-span-5">{formError}</p>}
            <p className="text-[10px] text-white/30 sm:col-span-2 lg:col-span-5">
              The worker signs in to the UrbanFix mobile app with this email and password and sees their assigned tasks.
            </p>
          </form>
        )}

        {workers.length === 0 ? (
          <p className="text-xs text-white/40 py-6 text-center">No field workers yet. Add one to start assigning tasks.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-white/35 text-left">
                  <th className="font-medium py-2 pr-3">Worker</th>
                  <th className="font-medium py-2 pr-3">Department</th>
                  <th className="font-medium py-2 pr-3 text-right">Active</th>
                  <th className="font-medium py-2 pr-3 text-right">In progress</th>
                  <th className="font-medium py-2 pr-3 text-right">Overdue</th>
                  <th className="font-medium py-2 pr-3 text-right">Resolved</th>
                  <th className="font-medium py-2 text-right">Last active</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w._id} className="border-t border-white/[0.05]">
                    <td className="py-2.5 pr-3">
                      <p className="text-white/85 font-medium">{w.name}</p>
                      <p className="text-[10px] text-white/30">{w.email}</p>
                    </td>
                    <td className="py-2.5 pr-3 text-white/60">{w.department || "—"}</td>
                    <td className="py-2.5 pr-3 text-right text-white/80 font-semibold">{w.activeTasks}</td>
                    <td className="py-2.5 pr-3 text-right text-blue-400">{w.inProgress}</td>
                    <td className={`py-2.5 pr-3 text-right ${w.overdue ? "text-red-400 font-semibold" : "text-white/30"}`}>{w.overdue}</td>
                    <td className="py-2.5 pr-3 text-right text-green-400">{w.resolved}</td>
                    <td className="py-2.5 text-right text-white/35">{w.lastLoginAt ? timeAgo(w.lastLoginAt) : "never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
