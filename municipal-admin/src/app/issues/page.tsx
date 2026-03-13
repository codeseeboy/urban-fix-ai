"use client";

import { useEffect, useState, useMemo } from "react";
import { issuesAPI } from "@/lib/api";
import { timeAgo, SEVERITY_COLORS, STATUS_COLORS, DEPARTMENTS } from "@/lib/utils";
import Link from "next/link";
import {
  Search, Filter, ChevronDown, MapPin, ArrowUpDown,
  Eye, ExternalLink, ChevronLeft, ChevronRight,
} from "lucide-react";

interface Issue {
  _id: string;
  title: string;
  status: string;
  aiSeverity: string;
  category: string;
  createdAt: string;
  departmentTag: string;
  upvotes?: string[];
  location?: { address?: string; coordinates?: number[] };
  priorityScore?: number;
  emergency?: boolean;
  image?: string;
  anonymous?: boolean;
}

const STATUSES = ["All", "Submitted", "Acknowledged", "InProgress", "Resolved", "Rejected"];
const SEVERITIES = ["All", "Critical", "High", "Medium", "Low"];
const PAGE_SIZE = 20;

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [deptFilter, setDeptFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"newest" | "priority" | "upvotes">("newest");
  const [page, setPage] = useState(0);

  useEffect(() => {
    issuesAPI
      .getFeed({ limit: 500 })
      .then(({ data }) => setIssues(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = [...issues];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.location?.address?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "All") list = list.filter((i) => i.status === statusFilter);
    if (severityFilter !== "All") list = list.filter((i) => i.aiSeverity === severityFilter);
    if (deptFilter !== "All") list = list.filter((i) => i.departmentTag === deptFilter);

    if (sortBy === "newest") list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    else if (sortBy === "priority") list.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
    else list.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));

    return list;
  }, [issues, search, statusFilter, severityFilter, deptFilter, sortBy]);

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    issues.forEach((i) => {
      m[i.status] = (m[i.status] || 0) + 1;
    });
    return m;
  }, [issues]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white">Issue Management</h1>
          <p className="text-xs sm:text-sm text-white/40 mt-0.5">{filtered.length} issues found</p>
        </div>
        {/* Quick status pills */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {["Submitted", "InProgress", "Resolved"].map((s) => (
            <div
              key={s}
              className="px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold whitespace-nowrap"
              style={{ color: STATUS_COLORS[s], background: STATUS_COLORS[s] + "15" }}
            >
              {s}: {statusCounts[s] || 0}
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-3 sm:p-4 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-[160px] sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search issues, locations, categories..."
            className="w-full h-9 pl-9 pr-4 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white placeholder-white/25 focus:outline-none focus:border-blue-500/40 transition"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
          className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All Status" : s}</option>)}
        </select>

        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
          className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
        >
          {SEVERITIES.map((s) => <option key={s} value={s}>{s === "All" ? "All Severity" : s}</option>)}
        </select>

        <select
          value={deptFilter}
          onChange={(e) => { setDeptFilter(e.target.value); setPage(0); }}
          className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none"
        >
          <option value="All">All Departments</option>
          {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <button
          onClick={() => setSortBy(sortBy === "newest" ? "priority" : sortBy === "priority" ? "upvotes" : "newest")}
          className="h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/50 hover:text-white/80 flex items-center gap-1.5 transition"
        >
          <ArrowUpDown className="w-3 h-3" />
          {sortBy === "newest" ? "Newest" : sortBy === "priority" ? "Priority" : "Upvotes"}
        </button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead>
              <tr className="text-[11px] text-white/30 border-b border-white/[0.06] bg-white/[0.02]">
                <th className="px-3 sm:px-4 py-3 font-medium w-[35%]">Issue</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Status</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Severity</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Department</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Priority</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Votes</th>
                <th className="px-3 sm:px-4 py-3 font-medium">Reported</th>
                <th className="px-3 sm:px-4 py-3 font-medium w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((issue) => (
                <tr key={issue._id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition group">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {issue.image ? (
                        <img src={issue.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/[0.06]" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                          <MapPin className="w-4 h-4 text-white/20" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <Link href={`/issues/${issue._id}`} className="text-xs font-medium text-white/80 group-hover:text-blue-400 transition line-clamp-1">
                          {issue.emergency && <span className="text-red-400 mr-1">🚨</span>}
                          {issue.title}
                        </Link>
                        <p className="text-[10px] text-white/25 mt-0.5 flex items-center gap-1 truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0" />
                          {issue.location?.address?.slice(0, 45) || "Unknown location"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-md" style={{ color: STATUS_COLORS[issue.status], background: (STATUS_COLORS[issue.status] || "#888") + "18" }}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-md" style={{ color: SEVERITY_COLORS[issue.aiSeverity], background: (SEVERITY_COLORS[issue.aiSeverity] || "#888") + "18" }}>
                      {issue.aiSeverity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">{issue.departmentTag || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, issue.priorityScore || 0)}%` }} />
                      </div>
                      <span className="text-[10px] text-white/40">{issue.priorityScore || 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50">{issue.upvotes?.length || 0}</td>
                  <td className="px-4 py-3 text-[11px] text-white/30">{timeAgo(issue.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/issues/${issue._id}`} className="w-7 h-7 rounded-md hover:bg-white/[0.06] flex items-center justify-center text-white/30 hover:text-blue-400 transition">
                      <Eye className="w-3.5 h-3.5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-[11px] text-white/30">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="w-7 h-7 rounded-md bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 disabled:opacity-30 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = page < 3 ? i : page + i - 2;
                if (p >= totalPages || p < 0) return null;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-md text-[11px] font-medium flex items-center justify-center transition ${p === page ? "bg-blue-500 text-white" : "bg-white/[0.04] text-white/40 hover:text-white/70"}`}
                  >
                    {p + 1}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="w-7 h-7 rounded-md bg-white/[0.04] flex items-center justify-center text-white/40 hover:text-white/70 disabled:opacity-30 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
