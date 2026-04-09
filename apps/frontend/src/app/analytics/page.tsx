"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Activity,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getUser, clearToken, isAuthenticated } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import { KPICard } from "@/components/analytics/KPICard";
import { StreamGraph } from "@/components/analytics/StreamGraph";
import { DepartmentGauge } from "@/components/analytics/DepartmentGauge";
import { ConfidenceHistogram } from "@/components/analytics/ConfidenceHistogram";
import { LiveFeed } from "@/components/analytics/LiveFeed";
import { SystemHealth } from "@/components/analytics/SystemHealth";
import { SLAComplianceArc } from "@/components/analytics/SLAComplianceArc";

// Sidebar nav items
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: false },
  { label: "Analytics", icon: BarChart3, href: "/analytics", active: true },
  { label: "Manager", icon: Users, href: "/manager", active: false },
  { label: "Admin", icon: Settings, href: "/admin", active: false },
];

interface OverviewKPIs {
  activeWorkflows: number;
  activeDelta: number;
  avgResponseMin: number;
  avgResponseDelta: number;
  resolvedPct: number;
  resolvedDelta: number;
  slaMissPct: number;
  slaMissDelta: number;
}

function generateMockKPIs(): OverviewKPIs {
  return {
    activeWorkflows: 18 + Math.floor(Math.random() * 10),
    activeDelta: 3,
    avgResponseMin: 7.2 + Math.random() * 3,
    avgResponseDelta: -1.2,
    resolvedPct: 92 + Math.random() * 6,
    resolvedDelta: 2.1,
    slaMissPct: 1.5 + Math.random() * 2,
    slaMissDelta: -0.8,
  };
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [kpis, setKpis] = useState<OverviewKPIs | null>(null);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    const user = getUser();
    if (user && user.role !== "manager" && user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [router]);

  const user = getUser();

  const fetchKPIs = useCallback(async () => {
    try {
      const res = await apiRequest<OverviewKPIs>("/api/analytics/overview");
      if (res.activeWorkflows !== undefined) {
        setKpis(res);
        return;
      }
    } catch {
      // API unavailable
    }
    setKpis((prev) => prev ?? generateMockKPIs());
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchKPIs();
    const interval = setInterval(fetchKPIs, 10_000);
    return () => clearInterval(interval);
  }, [ready, fetchKPIs]);

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  if (!ready) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-[var(--bg-primary)]">
        {/* Logo */}
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent,#d4a574)]/10">
            <Activity className="h-4 w-4 text-[var(--accent,#d4a574)]" />
          </div>
          <h1 className="font-display text-xl font-bold text-[var(--text-primary)]">
            Hospi<span className="text-[var(--accent,#d4a574)]">Q</span>
          </h1>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 py-4">
            <nav className="space-y-0.5">
              {navItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => (item.active ? null : router.push(item.href))}
                  className={`
                    flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors
                    ${
                      item.active
                        ? "bg-[var(--accent,#d4a574)]/10 text-[var(--accent,#d4a574)]"
                        : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                    }
                  `}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </ScrollArea>

        {/* User info + logout */}
        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent,#d4a574)]/10 text-[10px] font-bold text-[var(--accent,#d4a574)]">
              {user?.role?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-[var(--text-primary)]">
                {user?.role ?? "Unknown"}
              </p>
              <p className="truncate text-[10px] text-[var(--text-muted)]">
                {user?.sub?.slice(0, 8) ?? ""}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1 text-[var(--text-muted)] transition-colors hover:bg-white/5 hover:text-[var(--text-primary)]"
              title="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/5 px-6 py-3">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            HospiQ Analytics
          </h2>
          <span className="text-sm text-[var(--text-muted)]">Hotel Mariana</span>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto p-6">
          {!kpis ? (
            <AnalyticsSkeleton />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* KPI row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  label="Active Workflows"
                  value={kpis.activeWorkflows}
                  format="number"
                  delta={kpis.activeDelta}
                  deltaLabel="vs last hour"
                  delay={0}
                />
                <KPICard
                  label="Avg Response"
                  value={kpis.avgResponseMin}
                  format="duration"
                  delta={kpis.avgResponseDelta}
                  deltaLabel="vs yesterday"
                  delay={0.1}
                />
                <KPICard
                  label="Resolved"
                  value={kpis.resolvedPct}
                  format="percent"
                  delta={kpis.resolvedDelta}
                  deltaLabel="vs yesterday"
                  delay={0.2}
                />
                <KPICard
                  label="SLA Miss"
                  value={kpis.slaMissPct}
                  format="percent"
                  delta={kpis.slaMissDelta}
                  deltaLabel="vs yesterday"
                  delay={0.3}
                />
              </div>

              {/* Charts row 1: Stream + Department Gauge */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <StreamGraph />
                <DepartmentGauge />
              </div>

              {/* Charts row 2: Confidence Histogram + Live Feed */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ConfidenceHistogram />
                <LiveFeed />
              </div>

              {/* System Health bar */}
              <SystemHealth />
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
