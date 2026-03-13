"use client";

import { useEffect, useState } from "react";
import { notificationsAPI } from "@/lib/api";
import { timeAgo } from "@/lib/utils";
import {
  Bell, CheckCheck, Trash2, RefreshCw, Inbox,
  MessageSquare, ArrowUp, Award, CheckCircle2, Zap,
} from "lucide-react";

const ICONS: Record<string, { icon: any; color: string }> = {
  status: { icon: Zap, color: "#3b82f6" },
  upvote: { icon: ArrowUp, color: "#f97316" },
  comment: { icon: MessageSquare, color: "#8b5cf6" },
  badge: { icon: Award, color: "#eab308" },
  points: { icon: Award, color: "#22c55e" },
  resolved: { icon: CheckCircle2, color: "#22c55e" },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifs = async () => {
    try {
      const { data } = await notificationsAPI.getAll();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { fetchNotifs(); }, []);

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4 sm:space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-400" /> Notifications
          </h1>
          {unreadCount > 0 && (
            <p className="text-xs sm:text-sm text-blue-400 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="h-8 px-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-semibold rounded-lg flex items-center gap-1.5 hover:bg-blue-500/20 transition"
            >
              <CheckCheck className="w-3 h-3" /> Mark all read
            </button>
          )}
          <button
            onClick={fetchNotifs}
            className="h-8 px-3 bg-white/[0.04] border border-white/[0.08] text-white/50 text-[11px] rounded-lg flex items-center gap-1.5 hover:text-white/80 transition"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Inbox className="w-12 h-12 text-white/10 mx-auto mb-3" />
          <p className="text-sm text-white/40">All caught up!</p>
          <p className="text-xs text-white/20 mt-1">No notifications to show</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n: any) => {
            const iconData = ICONS[n.type] || ICONS.status;
            const Icon = iconData.icon;
            return (
              <div
                key={n._id}
                className={`glass-card p-4 flex items-start gap-3 transition ${!n.read ? "border-blue-500/20 bg-blue-500/[0.03]" : ""}`}
              >
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: iconData.color + "15" }}
                >
                  <Icon className="w-4 h-4" style={{ color: iconData.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white/80">{n.title}</p>
                  <p className="text-[11px] text-white/40 mt-0.5 line-clamp-2">{n.desc}</p>
                  <p className="text-[10px] text-white/20 mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded shrink-0">NEW</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
