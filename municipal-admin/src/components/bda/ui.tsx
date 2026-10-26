"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Database } from "lucide-react";

/** Fetch helper with loading/error state for the BDA endpoints. */
export function useBda<T>(load: () => Promise<{ data: T }>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    run()
      .then((r) => alive && (setData(r.data), setError(null)))
      .catch((e) => alive && setError(e?.response?.data?.message || e?.message || "Failed to load"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [run]);

  return { data, error, loading };
}

export const TIER = {
  CRITICAL: { label: "Critical", color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  MODERATE: { label: "Moderate", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  LOW: { label: "Low", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  UNKNOWN: { label: "Unknown", color: "#64748b", bg: "rgba(100,116,139,0.12)" },
} as const;

export const tierOf = (t?: string) => TIER[(t as keyof typeof TIER) ?? "UNKNOWN"] ?? TIER.UNKNOWN;

export const RAIN = "#38bdf8";
export const COMPLAINT = "#f97316";

export const fmt = (n?: number | null, d = 0) =>
  n === null || n === undefined || Number.isNaN(n) ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: d });

export const bytes = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`);

export const chartTooltip = {
  contentStyle: { background: "#0f1020", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12, color: "#e2e8f0" },
  labelStyle: { color: "rgba(255,255,255,0.55)", marginBottom: 4 },
  itemStyle: { padding: 0 },
};

export const axis = { tick: { fill: "rgba(255,255,255,0.35)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`glass-card p-4 sm:p-5 ${className}`}>{children}</div>;
}

export function SectionTitle({ icon: Icon, title, subtitle, right, tint = "text-sky-400" }: { icon: LucideIcon; title: string; subtitle?: string; right?: ReactNode; tint?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Icon className={`w-4 h-4 ${tint}`} /> {title}
        </h2>
        {subtitle && <p className="text-[11px] text-white/40 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Stat({ icon: Icon, label, value, hint, tint = "#38bdf8" }: { icon: LucideIcon; label: string; value: ReactNode; hint?: ReactNode; tint?: string }) {
  return (
    <div className="glass-card p-4 relative overflow-hidden">
      <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full blur-2xl opacity-20" style={{ background: tint }} />
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: `${tint}1f` }}>
        <Icon className="w-4 h-4" style={{ color: tint }} />
      </div>
      <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{value}</p>
      <p className="text-[11px] text-white/45 mt-0.5">{label}</p>
      {hint && <p className="text-[10px] text-white/30 mt-1.5 leading-snug">{hint}</p>}
    </div>
  );
}

export function TierPill({ tier }: { tier?: string }) {
  const t = tierOf(tier);
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: t.color, background: t.bg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} />
      {t.label}
    </span>
  );
}

export function Loading({ label = "Reading the data lake…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
      <p className="text-xs text-white/40">{label}</p>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="glass-card p-6 flex items-start gap-3 border-red-500/20">
      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
      <div>
        <p className="text-sm font-semibold text-white">Couldn&apos;t load BDA data</p>
        <p className="text-xs text-white/50 mt-1">{message}</p>
      </div>
    </div>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] text-white/30 flex items-center gap-1.5 mt-3">
      <Database className="w-3 h-3" /> {children}
    </p>
  );
}
