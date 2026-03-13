"use client";

import { useAuth } from "@/lib/auth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "./Sidebar";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && pathname !== "/login") {
      router.replace("/login");
    }
  }, [user, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06060e] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#06060e]">
      <Sidebar />
      <main className="min-h-screen pt-14 lg:pt-0 lg:ml-[260px]">
        {children}
      </main>
    </div>
  );
}
