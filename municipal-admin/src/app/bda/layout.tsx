"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit, CloudRain, CloudSun, Gauge, GitMerge, Grid3x3, Map, Network, ShieldCheck, Workflow } from "lucide-react";

const TABS = [
  { href: "/bda", label: "Overview", icon: Workflow },
  { href: "/bda/outlook", label: "Live Outlook", icon: CloudSun },
  { href: "/bda/fusion", label: "Rain × Complaints", icon: CloudRain },
  { href: "/bda/wards", label: "Ward Risk", icon: Map },
  { href: "/bda/planner", label: "Surge Planner", icon: Gauge },
  { href: "/bda/ml", label: "MLlib Forecast", icon: BrainCircuit },
  { href: "/bda/patterns", label: "Patterns", icon: Grid3x3 },
  { href: "/bda/quality", label: "Data Quality", icon: ShieldCheck },
  { href: "/bda/pipeline", label: "Pipeline & Reports", icon: Network },
];

export default function BdaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-sky-400/80 uppercase flex items-center gap-1.5">
            <GitMerge className="w-3 h-3" /> Big Data Analytics · Kafka → Data Lake → Spark
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1">Monsoon Intelligence</h1>
          <p className="text-xs sm:text-sm text-white/45 mt-1 max-w-2xl">
            Real Mumbai rainfall fused with civic complaints across 24 BMC wards — when complaints surge, where, and what to do about it.
          </p>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 border-b border-white/[0.06]">
        {TABS.map((t) => {
          const active = t.href === "/bda" ? pathname === "/bda" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex items-center gap-2 px-3.5 h-10 text-xs font-medium whitespace-nowrap border-b-2 -mb-[5px] transition ${
                active ? "border-sky-400 text-white" : "border-transparent text-white/45 hover:text-white/80"
              }`}
            >
              <t.icon className={`w-3.5 h-3.5 ${active ? "text-sky-400" : ""}`} /> {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
