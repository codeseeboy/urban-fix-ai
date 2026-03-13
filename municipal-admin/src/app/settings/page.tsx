"use client";

import { useAuth } from "@/lib/auth";
import {
  Settings, User, Shield, Bell, Database, HelpCircle,
  LogOut, Moon, Globe, Key,
} from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();

  const sections = [
    {
      title: "Account",
      items: [
        { icon: User, label: "Profile", value: user?.name || "Admin", color: "#3b82f6" },
        { icon: Key, label: "Email", value: user?.email || "—", color: "#8b5cf6" },
        { icon: Shield, label: "Role", value: user?.role || "admin", color: "#22c55e" },
        { icon: Globe, label: "City", value: user?.city || "Not set", color: "#f97316" },
      ],
    },
    {
      title: "Preferences",
      items: [
        { icon: Moon, label: "Theme", value: "Dark (Default)", color: "#a855f7" },
        { icon: Bell, label: "Notifications", value: "Enabled", color: "#eab308" },
        { icon: Database, label: "Data Region", value: "India", color: "#06b6d4" },
      ],
    },
    {
      title: "Support",
      items: [
        { icon: HelpCircle, label: "Help & Support", value: "support@urbanfix.ai", color: "#3b82f6" },
        { icon: Shield, label: "Privacy Policy", value: "urbanfix.ai/privacy", color: "#22c55e" },
        { icon: Settings, label: "Version", value: "1.0.0 · Build 1", color: "#6b7280" },
      ],
    },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-400" /> Settings
        </h1>
        <p className="text-xs sm:text-sm text-white/40 mt-0.5">Manage your account and preferences</p>
      </div>

      {sections.map((section) => (
        <div key={section.title}>
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-wider mb-2 ml-1">
            {section.title}
          </p>
          <div className="glass-card overflow-hidden">
            {section.items.map((item, i) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 px-4 py-3.5 ${i < section.items.length - 1 ? "border-b border-white/[0.04]" : ""}`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: item.color + "15" }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-white/80">{item.label}</p>
                </div>
                <p className="text-xs text-white/40">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Danger Zone */}
      <div>
        <p className="text-[11px] font-semibold text-red-400/60 uppercase tracking-wider mb-2 ml-1">
          Danger Zone
        </p>
        <div className="glass-card border-red-500/10 overflow-hidden">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-500/5 transition"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-500/10 shrink-0">
              <LogOut className="w-4 h-4 text-red-400" />
            </div>
            <p className="text-xs font-medium text-red-400">Sign Out</p>
          </button>
        </div>
      </div>

      <p className="text-center text-[11px] text-white/15 pt-4">
        UrbanFix AI v1.0.0 &middot; Municipal Admin Portal &middot; &copy; 2026
      </p>
    </div>
  );
}
