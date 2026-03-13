"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { issuesAPI } from "@/lib/api";
import { formatDate, SEVERITY_COLORS, STATUS_COLORS, DEPARTMENTS } from "@/lib/utils";
import {
  ArrowLeft, MapPin, Clock, Users, MessageSquare, AlertTriangle,
  CheckCircle2, ChevronRight, Send, Zap, Building2,
} from "lucide-react";

export default function IssueDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdate, setStatusUpdate] = useState("");
  const [statusComment, setStatusComment] = useState("");
  const [deptAssign, setDeptAssign] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!id) return;
    issuesAPI
      .getById(id as string)
      .then(({ data }) => {
        setIssue(data);
        setDeptAssign(data.departmentTag || "");
      })
      .catch(() => router.replace("/issues"))
      .finally(() => setLoading(false));
  }, [id, router]);

  const handleStatusUpdate = async () => {
    if (!statusUpdate || updating) return;
    setUpdating(true);
    try {
      await issuesAPI.updateStatus(id as string, statusUpdate, statusComment || undefined);
      const { data } = await issuesAPI.getById(id as string);
      setIssue(data);
      setStatusUpdate("");
      setStatusComment("");
    } catch (e) {
      console.error(e);
    }
    setUpdating(false);
  };

  const handleAssign = async () => {
    if (!deptAssign || updating) return;
    setUpdating(true);
    try {
      await issuesAPI.assign(id as string, { departmentTag: deptAssign });
      const { data } = await issuesAPI.getById(id as string);
      setIssue(data);
    } catch (e) {
      console.error(e);
    }
    setUpdating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!issue) return null;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/50 hover:text-white transition shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              {issue.emergency && <span className="text-red-400">🚨</span>}
              <span className="truncate">{issue.title}</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-white/40 flex items-center gap-2 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{issue.location?.address || "Unknown"}</span>
              <span className="text-white/15 shrink-0">&middot;</span>
              <Clock className="w-3 h-3 shrink-0" /> {formatDate(issue.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-12 sm:ml-0">
          <span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg" style={{ color: STATUS_COLORS[issue.status], background: (STATUS_COLORS[issue.status] || "#888") + "18" }}>
            {issue.status}
          </span>
          <span className="text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg" style={{ color: SEVERITY_COLORS[issue.aiSeverity], background: (SEVERITY_COLORS[issue.aiSeverity] || "#888") + "18" }}>
            {issue.aiSeverity}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Image */}
          {issue.image && (
            <div className="glass-card overflow-hidden">
              <img src={issue.image} alt={issue.title} className="w-full h-64 object-cover" />
            </div>
          )}

          {/* Details Card */}
          <div className="glass-card p-3 sm:p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white">Description</h2>
            <p className="text-sm text-white/60 leading-relaxed">{issue.description || "No description provided."}</p>

            {/* AI Tags */}
            {issue.aiTags?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {issue.aiTags.map((tag: string, i: number) => (
                  <span key={i} className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    🤖 {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Meta grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              {[
                { label: "Category", value: issue.category || "—" },
                { label: "Department", value: issue.departmentTag || "—" },
                { label: "Priority Score", value: `${issue.priorityScore || 0}/100` },
                { label: "Upvotes", value: issue.upvotes?.length || 0 },
              ].map((m) => (
                <div key={m.label} className="bg-white/[0.03] rounded-lg p-3">
                  <p className="text-[10px] text-white/30 mb-0.5">{m.label}</p>
                  <p className="text-sm font-semibold text-white/80">{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          {issue.statusTimeline?.length > 0 && (
            <div className="glass-card p-3 sm:p-5">
              <h2 className="text-sm font-semibold text-white mb-4">Status Timeline</h2>
              <div className="space-y-4">
                {issue.statusTimeline.map((s: any, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-3 h-3 rounded-full border-2 shrink-0" style={{ borderColor: STATUS_COLORS[s.status] || "#555", background: i === 0 ? (STATUS_COLORS[s.status] || "#555") : "transparent" }} />
                      {i < issue.statusTimeline.length - 1 && <div className="w-0.5 flex-1 bg-white/[0.06] mt-1" />}
                    </div>
                    <div className="pb-4">
                      <p className="text-xs font-semibold text-white/80">{s.status}</p>
                      {s.comment && <p className="text-[11px] text-white/40 mt-0.5">{s.comment}</p>}
                      <p className="text-[10px] text-white/20 mt-1">{formatDate(s.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          <div className="glass-card p-3 sm:p-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Comments ({issue.comments?.length || 0})
            </h2>
            {(!issue.comments || issue.comments.length === 0) && (
              <p className="text-xs text-white/30">No comments yet</p>
            )}
            <div className="space-y-3">
              {issue.comments?.map((c: any, i: number) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-white/[0.02]">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {c.user?.name?.[0] || "?"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white/70">{c.user?.name || "Unknown"}</span>
                      {c.user?.role === "admin" && (
                        <span className="text-[9px] font-bold text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">OFFICIAL</span>
                      )}
                      <span className="text-[10px] text-white/20">{c.timeAgo}</span>
                    </div>
                    <p className="text-xs text-white/50 mt-1">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-5">
          {/* Update Status */}
          <div className="glass-card p-3 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" /> Update Status
            </h3>
            <select
              value={statusUpdate}
              onChange={(e) => setStatusUpdate(e.target.value)}
              className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none mb-2"
            >
              <option value="">Select new status...</option>
              {["Acknowledged", "InProgress", "Resolved", "Rejected"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <textarea
              value={statusComment}
              onChange={(e) => setStatusComment(e.target.value)}
              placeholder="Add a comment (optional)..."
              className="w-full h-20 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 placeholder-white/20 focus:outline-none resize-none mb-2"
            />
            <button
              onClick={handleStatusUpdate}
              disabled={!statusUpdate || updating}
              className="w-full h-9 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-40"
            >
              {updating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Send className="w-3.5 h-3.5" /> Update Status</>}
            </button>
          </div>

          {/* Assign Department */}
          <div className="glass-card p-3 sm:p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-400" /> Assign Department
            </h3>
            <select
              value={deptAssign}
              onChange={(e) => setDeptAssign(e.target.value)}
              className="w-full h-9 px-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/70 focus:outline-none mb-2"
            >
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <button
              onClick={handleAssign}
              disabled={!deptAssign || updating}
              className="w-full h-9 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-40"
            >
              Assign
            </button>
          </div>

          {/* Quick Info */}
          <div className="glass-card p-3 sm:p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">Quick Info</h3>
            {[
              { label: "Issue ID", value: issue._id.slice(-8) },
              { label: "Anonymous", value: issue.anonymous ? "Yes" : "No" },
              { label: "Emergency", value: issue.emergency ? "Yes" : "No" },
              { label: "Followers", value: issue.followers?.length || 0 },
              { label: "Downvotes", value: issue.downvotes?.length || 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-white/40">{item.label}</span>
                <span className="text-white/70 font-medium">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
