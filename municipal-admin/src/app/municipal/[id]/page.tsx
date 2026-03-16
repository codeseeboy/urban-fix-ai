"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { municipalAPI } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import {
  ArrowLeft, CheckCircle2, Users, Globe, Send, Plus,
  Megaphone, FileText, AlertTriangle, Wrench, ClipboardList,
  Calendar, MapPin,
} from "lucide-react";

const POST_TYPES = [
  { value: "Announcement", label: "Announcement", icon: Megaphone, color: "blue" },
  { value: "PublicNotice", label: "Public Notice", icon: ClipboardList, color: "amber" },
  { value: "ProjectUpdate", label: "Project Update", icon: Wrench, color: "emerald" },
  { value: "Emergency", label: "Emergency Alert", icon: AlertTriangle, color: "red" },
  { value: "WorkCompletion", label: "Work Completion", icon: CheckCircle2, color: "green" },
];

const typeColorMap: Record<string, string> = {
  Announcement: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  PublicNotice: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  ProjectUpdate: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Emergency: "bg-red-500/10 text-red-400 border-red-500/20",
  WorkCompletion: "bg-green-500/10 text-green-400 border-green-500/20",
};

export default function MunicipalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pageId = params.id as string;

  const [page, setPage] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [postForm, setPostForm] = useState({
    title: "", description: "", officialUpdateType: "Announcement", address: "",
  });
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  const fetchData = async () => {
    try {
      const [pageRes, postsRes] = await Promise.all([
        municipalAPI.getById(pageId),
        municipalAPI.getPosts(pageId),
      ]);
      setPage(pageRes.data);
      setPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [pageId]);

  const handlePost = async () => {
    if (!postForm.title || posting) return;
    setPosting(true);
    setPostError("");
    try {
      await municipalAPI.createPost(pageId, {
        title: postForm.title,
        description: postForm.description,
        officialUpdateType: postForm.officialUpdateType,
        location: { address: postForm.address || page?.region?.city || "" },
      });
      setPostForm({ title: "", description: "", officialUpdateType: "Announcement", address: "" });
      setShowCompose(false);
      fetchData();
    } catch (e: any) {
      setPostError(e.response?.data?.message || "Failed to create post");
    }
    setPosting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="p-6">
        <button onClick={() => router.push("/municipal")} className="text-sm text-blue-400 flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Pages
        </button>
        <div className="glass-card p-12 text-center">
          <p className="text-white/40">Page not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <button onClick={() => router.push("/municipal")} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mb-4 transition">
          <ArrowLeft className="w-3.5 h-3.5" /> All Pages
        </button>

        <div className="glass-card p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 sm:items-start">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
              {page.name?.[0] || "M"}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                {page.name}
                {page.verified && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeColorMap[page.page_type || page.pageType] || "bg-white/5 text-white/40 border-white/10"}`}>
                  {page.page_type || page.pageType}
                </span>
              </h1>
              <p className="text-xs text-white/30 mt-0.5">@{page.handle}</p>
              {page.description && <p className="text-sm text-white/50 mt-2">{page.description}</p>}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-white/30">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {page.followersCount || page.followers_count || 0} followers</span>
                <span className="flex items-center gap-1"><Globe className="w-3.5 h-3.5" /> {page.department}</span>
                {page.region?.city && (
                  <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {page.region.city}{page.region.ward ? ` \u2014 Ward ${page.region.ward}` : ""}</span>
                )}
                <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {posts.length} posts</span>
              </div>
            </div>
            <button
              onClick={() => setShowCompose(true)}
              className="h-9 px-4 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shrink-0"
            >
              <Plus className="w-3.5 h-3.5" /> New Post
            </button>
          </div>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowCompose(false)}>
          <div className="glass-card p-5 sm:p-6 w-full max-w-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold text-white mb-1">Create Post</h2>
            <p className="text-xs text-white/30 mb-4">Posting as <span className="text-blue-400">@{page.handle}</span> &mdash; will appear in citizens&apos; municipal feed</p>

            {postError && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">{postError}</p>}

            <div className="space-y-3">
              {/* Post type pills */}
              <div className="flex flex-wrap gap-1.5">
                {POST_TYPES.map((t) => {
                  const Icon = t.icon;
                  const active = postForm.officialUpdateType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setPostForm({ ...postForm, officialUpdateType: t.value })}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition ${
                        active
                          ? typeColorMap[t.value]
                          : "bg-white/[0.03] text-white/30 border-white/[0.06] hover:border-white/10"
                      }`}
                    >
                      <Icon className="w-3 h-3" /> {t.label}
                    </button>
                  );
                })}
              </div>

              <input
                value={postForm.title}
                onChange={(e) => setPostForm({ ...postForm, title: e.target.value })}
                placeholder="Post title..."
                className="w-full h-10 px-4 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
              <textarea
                value={postForm.description}
                onChange={(e) => setPostForm({ ...postForm, description: e.target.value })}
                placeholder="Description / details..."
                rows={4}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none resize-none"
              />
              <input
                value={postForm.address}
                onChange={(e) => setPostForm({ ...postForm, address: e.target.value })}
                placeholder={`Location (default: ${page.region?.city || "N/A"})`}
                className="w-full h-10 px-4 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCompose(false)} className="flex-1 h-10 bg-white/[0.04] text-white/60 text-sm rounded-lg hover:bg-white/[0.08] transition">
                  Cancel
                </button>
                <button
                  onClick={handlePost}
                  disabled={!postForm.title || posting}
                  className="flex-1 h-10 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40 transition flex items-center justify-center gap-1.5"
                >
                  {posting ? "Publishing..." : <><Send className="w-3.5 h-3.5" /> Publish</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts List */}
      <div>
        <h2 className="text-sm font-semibold text-white/60 mb-3 flex items-center gap-2">
          <Megaphone className="w-4 h-4" /> Posts &amp; Announcements
        </h2>
        {posts.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Megaphone className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">No posts yet</p>
            <p className="text-xs text-white/20 mt-1">Create your first post to reach citizens</p>
            <button
              onClick={() => setShowCompose(true)}
              className="mt-4 h-8 px-4 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-xs font-medium rounded-lg transition"
            >
              Create Post
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post: any) => (
              <div key={post._id || post.id} className="glass-card p-4 sm:p-5 hover:border-white/[0.08] transition">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                    {page.name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{post.title}</h3>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${typeColorMap[post.official_update_type] || "bg-white/5 text-white/40 border-white/10"}`}>
                            {post.official_update_type?.replace(/([A-Z])/g, " $1").trim() || "Post"}
                          </span>
                          {post.location_address && (
                            <span className="text-[10px] text-white/20 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" /> {post.location_address}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] text-white/20 flex items-center gap-1 shrink-0">
                        <Calendar className="w-3 h-3" /> {post.created_at ? timeAgo(post.created_at) : "N/A"}
                      </span>
                    </div>
                    {post.description && (
                      <p className="text-xs text-white/40 mt-2 leading-relaxed">{post.description}</p>
                    )}
                    {post.image && (
                      <img src={post.image} alt="" className="mt-3 rounded-lg max-h-40 object-cover border border-white/[0.06]" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
