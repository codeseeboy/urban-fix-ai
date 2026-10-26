"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, CircleDashed, FileImage, Network, X } from "lucide-react";
import { API_BASE, bdaAPI } from "@/lib/api";
import { Card, ErrorBox, Loading, SectionTitle, useBda } from "@/components/bda/ui";

type Jobs = {
  jobs: {
    id: string;
    name: string;
    tech: string;
    script: string;
    does: string;
    lastRun: string | null;
    status: "ok" | "partial" | "missing";
    outputs: { path: string; updatedAt: string | null; exists: boolean }[];
  }[];
  figures: { name: string; updatedAt: string }[];
};

const STATUS = {
  ok: { icon: CheckCircle2, color: "#22c55e", label: "Outputs present" },
  partial: { icon: CircleAlert, color: "#f59e0b", label: "Some outputs missing" },
  missing: { icon: CircleDashed, color: "#64748b", label: "Not run yet" },
};

const pretty = (f: string) =>
  f
    .replace(/\.png$/, "")
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

export default function PipelinePage() {
  const { data, error, loading } = useBda<Jobs>(() => bdaAPI.jobs());
  const [open, setOpen] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} />;

  const fig = (name: string) => `${API_BASE}/bda/figures/${name}`;

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={Network} title="Pipeline stages" subtitle="Every stage of the BDA pipeline, what it does, and when it last wrote its outputs to the lake." />
        <div className="relative">
          <div className="absolute left-[15px] top-3 bottom-3 w-px bg-white/[0.08]" />
          <div className="space-y-3">
            {data.jobs.map((j) => {
              const s = STATUS[j.status];
              return (
                <div key={j.id} className="relative flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#0d0d18] border border-white/[0.1] flex items-center justify-center shrink-0 z-10">
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <div className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-mono text-white/35">{j.id}</span>
                      <p className="text-sm font-semibold text-white">{j.name}</p>
                      <span className="text-[10px] text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full">{j.tech}</span>
                      <span className="ml-auto text-[10px] text-white/35">{j.lastRun ? `last output ${new Date(j.lastRun).toLocaleString()}` : s.label}</span>
                    </div>
                    <p className="text-xs text-white/55 mt-1.5">{j.does}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <code className="text-[10px] text-white/45 bg-white/[0.04] px-1.5 py-0.5 rounded">{j.script}</code>
                      {j.outputs.map((o) => (
                        <code key={o.path} className={`text-[10px] px-1.5 py-0.5 rounded ${o.exists ? "text-emerald-300/80 bg-emerald-500/[0.07]" : "text-white/30 bg-white/[0.03] line-through"}`}>
                          → {o.path}
                        </code>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon={FileImage} title="Generated report figures" subtitle="Charts written by the Spark jobs (matplotlib). Click to enlarge." tint="text-violet-400" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.figures.map((f) => (
            <button key={f.name} onClick={() => setOpen(f.name)} className="group text-left rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden hover:border-white/[0.15] transition">
              <div className="aspect-[4/3] bg-white flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fig(f.name)} alt={pretty(f.name)} className="w-full h-full object-contain group-hover:scale-[1.02] transition" loading="lazy" />
              </div>
              <p className="text-xs text-white/75 px-3 py-2">{pretty(f.name)}</p>
            </button>
          ))}
        </div>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setOpen(null)} className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-1 text-xs">
              <X className="w-4 h-4" /> Close
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fig(open)} alt={pretty(open)} className="w-full rounded-xl bg-white" />
            <p className="text-sm text-white/80 mt-2">{pretty(open)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
