"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getUser, isAuthenticated } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { AppShell } from "@/components/shared/AppShell";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import { KPICard } from "@/components/analytics/KPICard";
import { StreamGraph } from "@/components/analytics/StreamGraph";
import { DepartmentGauge } from "@/components/analytics/DepartmentGauge";
import { ConfidenceHistogram } from "@/components/analytics/ConfidenceHistogram";
import { LiveFeed } from "@/components/analytics/LiveFeed";
import { SystemHealth } from "@/components/analytics/SystemHealth";
import { SLAComplianceArc } from "@/components/analytics/SLAComplianceArc";

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

  if (!ready) {
    return <AnalyticsSkeleton />;
  }

  return (
    <AppShell
      activePage="analytics"
      headerRight={
        <span className="text-sm text-[var(--text-muted)]">Hotel Mariana</span>
      }
    >
      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-6">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            HospiQ Analytics
          </h2>
          <span className="hidden md:inline text-sm text-[var(--text-muted)]">Hotel Mariana</span>
        </header>

        {/* Scrollable content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {!kpis ? (
            <AnalyticsSkeleton />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* KPI row */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
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
    </AppShell>
  );
}
