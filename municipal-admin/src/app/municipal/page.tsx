"use client";

import { useEffect, useState } from "react";
import { municipalAPI, issuesAPI } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import {
  Building2, Plus, Users, FileText, Globe, Search,
  CheckCircle2, Eye, Edit, Megaphone,
} from "lucide-react";

export default function MunicipalPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", handle: "", department: "", description: "" });
  const [creating, setCreating] = useState(false);

  const fetchPages = async () => {
    try {
      const { data } = await municipalAPI.suggested();
      setPages(Array.isArray(data) ? data : []);
    } catch (e) {
      try {
        const { data } = await municipalAPI.search("");
        setPages(Array.isArray(data) ? data : []);
      } catch { }
    }
    setLoading(false);
  };

  useEffect(() => { fetchPages(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.handle || !form.department || creating) return;
    setCreating(true);
    try {
      await municipalAPI.create(form);
      setShowCreate(false);
      setForm({ name: "", handle: "", department: "", description: "" });
      fetchPages();
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-400" /> Municipal Pages
          </h1>
          <p className="text-xs sm:text-sm text-white/40 mt-0.5">Manage official municipal department pages</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" /> Create Page
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCreate(false)}>
          <div className="glass-card p-5 sm:p-6 w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-white mb-4">Create Municipal Page</h2>
            <div className="space-y-3">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Page Name (e.g., Boisar Municipal Corp)"
                className="w-full h-10 px-4 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
              <input
                value={form.handle}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
                placeholder="Handle (e.g., @boisar-municipal)"
                className="w-full h-10 px-4 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
              <select
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="w-full h-10 px-4 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/70 focus:outline-none"
              >
                <option value="">Select Department</option>
                {["Roads", "Sanitation", "Water", "Electricity", "Parks", "General"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Description..."
                className="w-full h-20 px-4 py-2 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none resize-none"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 h-10 bg-white/[0.04] text-white/60 text-sm rounded-lg hover:bg-white/[0.08] transition">
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={!form.name || !form.handle || !form.department || creating}
                  className="flex-1 h-10 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pages Grid */}
      {pages.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Building2 className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40">No municipal pages created yet</p>
          <p className="text-xs text-white/20 mt-1">Create your first official municipal page</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {pages.map((p: any) => (
            <div key={p._id} className="glass-card p-5 hover:border-blue-500/20 transition group">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {p.name?.[0] || "M"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
                    {p.name}
                    {p.verified && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </h3>
                  <p className="text-[11px] text-white/30">@{p.handle}</p>
                </div>
              </div>
              <p className="text-xs text-white/40 line-clamp-2 mb-3">{p.description || "Official municipal page"}</p>
              <div className="flex items-center gap-4 text-[10px] text-white/30">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {p.followersCount || 0} followers</span>
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" /> {p.department}</span>
              </div>
              {p.region && (
                <p className="text-[10px] text-white/20 mt-2">
                  {p.region.city} {p.region.ward ? `- ${p.region.ward}` : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
