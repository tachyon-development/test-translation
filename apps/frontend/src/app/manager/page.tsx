"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Workflow } from "@/hooks/useWebSocket";
import { getUser, getToken, isAuthenticated } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AppShell } from "@/components/shared/AppShell";
import { EscalationCard } from "@/components/manager/EscalationCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Clock,
  Sparkles,
  Loader2,
  TrendingDown,
} from "lucide-react";

interface AnalyticsOverview {
  activeWorkflows: number;
  slaMissRate: number;
  escalatedCount: number;
}

export default function ManagerPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Auth check — require manager or admin
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

  const { workflows, connected, connectionStatus } = useWebSocket();

  // KPI state
  const [kpis, setKpis] = useState<AnalyticsOverview | null>(null);
  const [kpisLoading, setKpisLoading] = useState(true);

  // Fetch KPIs
  useEffect(() => {
    if (!ready) return;
    const token = getToken();
    if (!token) return;

    const fetchKpis = async () => {
      try {
        const data = await apiRequest<AnalyticsOverview>("/api/analytics/overview", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setKpis(data);
      } catch {
        // Fallback: derive from WS data
      } finally {
        setKpisLoading(false);
      }
    };

    fetchKpis();
    const interval = setInterval(fetchKpis, 30000);
    return () => clearInterval(interval);
  }, [ready]);

  // Filter to escalated workflows only, sorted by most overdue first
  const escalatedWorkflows = useMemo(() => {
    return workflows
      .filter((w) => w.status === "escalated" || w.escalated)
      .sort((a, b) => {
        const aDeadline = a.slaDeadline ? new Date(a.slaDeadline).getTime() : Infinity;
        const bDeadline = b.slaDeadline ? new Date(b.slaDeadline).getTime() : Infinity;
        return aDeadline - bDeadline;
      });
  }, [workflows]);

  // Derive KPIs from WS data as fallback
  const derivedKpis = useMemo(() => {
    const active = workflows.filter(
      (w) => w.status !== "resolved" && w.status !== "cancelled"
    );
    const withSla = active.filter((w) => w.slaDeadline);
    const breached = withSla.filter(
      (w) => new Date(w.slaDeadline!).getTime() < Date.now()
    ).length;
    const slaMissRate = withSla.length > 0 ? (breached / withSla.length) * 100 : 0;

    return {
      activeWorkflows: active.length,
      slaMissRate: Math.round(slaMissRate * 10) / 10,
      escalatedCount: escalatedWorkflows.length,
    };
  }, [workflows, escalatedWorkflows]);

  const displayKpis = kpis ?? derivedKpis;

  // Action handler for escalation cards
  const handleAction = useCallback(
    async (workflowId: string, action: string, data?: Record<string, unknown>) => {
      const token = getToken();
      if (!token) return;
      const headers = { Authorization: `Bearer ${token}` };

      switch (action) {
        case "override":
          await apiRequest(`/api/workflows/${workflowId}/classify`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              departmentId: data?.departmentId,
              priority: data?.priority,
              reason: data?.reason,
            }),
          });
          break;

        case "reassign":
          await apiRequest(`/api/workflows/${workflowId}/claim`, {
            method: "POST",
            headers,
            body: JSON.stringify({ assignTo: data?.assignTo }),
          });
          break;

        case "resolve":
          await apiRequest(`/api/workflows/${workflowId}/status`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({
              status: "resolved",
              resolutionNote: data?.note ?? "",
            }),
          });
          break;

        case "comment":
          await apiRequest(`/api/workflows/${workflowId}/comment`, {
            method: "POST",
            headers,
            body: JSON.stringify({ text: data?.text }),
          });
          break;
      }
    },
    []
  );

  const connStatus =
    connectionStatus === "connected"
      ? ("connected" as const)
      : connectionStatus === "reconnecting"
        ? ("reconnecting" as const)
        : ("disconnected" as const);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  // Manager sidebar extra: compact KPIs
  const sidebarExtra = (
    <div className="mt-6 border-t border-white/5 pt-4">
      <h3 className="font-display mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
        Escalation KPIs
      </h3>

      <div className="space-y-2 px-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <Clock className="h-3 w-3" />
            Active
          </span>
          <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--text-primary)]">
            {kpisLoading ? (
              <span className="inline-block h-4 w-6 animate-pulse rounded bg-white/10" />
            ) : (
              displayKpis.activeWorkflows
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <TrendingDown className="h-3 w-3 text-[#c17767]" />
            SLA Miss
          </span>
          <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-[#c17767]">
            {kpisLoading ? (
              <span className="inline-block h-4 w-8 animate-pulse rounded bg-white/10" />
            ) : (
              `${displayKpis.slaMissRate}%`
            )}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
            <AlertTriangle className="h-3 w-3 text-[#c17767]" />
            Escalated
          </span>
          <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-[#c17767]">
            {kpisLoading ? (
              <span className="inline-block h-4 w-4 animate-pulse rounded bg-white/10" />
            ) : (
              displayKpis.escalatedCount
            )}
          </span>
        </div>
      </div>
    </div>
  );

  // Mobile top bar: compact KPIs in a horizontal row
  const mobileKpiBar = (
    <div className="flex items-center justify-around px-4 py-2">
      <div className="flex items-center gap-1.5 text-xs">
        <Clock className="h-3 w-3 text-[var(--text-muted)]" />
        <span className="text-[var(--text-secondary)]">Active</span>
        <span className="font-[family-name:var(--font-mono)] font-bold text-[var(--text-primary)]">
          {kpisLoading ? "..." : displayKpis.activeWorkflows}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <TrendingDown className="h-3 w-3 text-[#c17767]" />
        <span className="text-[var(--text-secondary)]">SLA</span>
        <span className="font-[family-name:var(--font-mono)] font-bold text-[#c17767]">
          {kpisLoading ? "..." : `${displayKpis.slaMissRate}%`}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <AlertTriangle className="h-3 w-3 text-[#c17767]" />
        <span className="text-[var(--text-secondary)]">Esc.</span>
        <span className="font-[family-name:var(--font-mono)] font-bold text-[#c17767]">
          {kpisLoading ? "..." : displayKpis.escalatedCount}
        </span>
      </div>
    </div>
  );

  return (
    <ErrorBoundary>
      <AppShell
        activePage="manager"
        sidebarExtra={sidebarExtra}
        headerRight={<ConnectionStatus status={connStatus} />}
        mobileTopBar={mobileKpiBar}
      >
        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-[#c17767]" />
              <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                Escalation Center
              </h2>
              {escalatedWorkflows.length > 0 && (
                <span className="rounded-full bg-[#c17767]/15 px-2.5 py-0.5 font-[family-name:var(--font-mono)] text-xs font-bold text-[#c17767]">
                  {escalatedWorkflows.length}
                </span>
              )}
            </div>
            <div className="hidden md:block">
              <ConnectionStatus status={connStatus} />
            </div>
          </header>

          {/* Escalation list */}
          <ScrollArea className="flex-1">
            <div className="p-4 md:p-6">
              <AnimatePresence mode="popLayout">
                {!connected && workflows.length === 0 ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center py-24"
                  >
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">
                      Connecting to real-time feed...
                    </p>
                  </motion.div>
                ) : escalatedWorkflows.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-1 flex-col items-center justify-center py-24 text-center"
                  >
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--status-success,#7c9885)]/10">
                      <Sparkles className="h-7 w-7 text-[var(--status-success,#7c9885)]" />
                    </div>
                    <h3 className="font-display mb-2 text-xl font-semibold text-[var(--text-primary)]">
                      No escalations — SLAs are holding
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      All workflows are within their SLA windows. Nice work.
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-4 max-w-3xl">
                    {escalatedWorkflows.map((workflow) => (
                      <EscalationCard
                        key={workflow.id}
                        workflow={workflow}
                        onAction={(action, data) =>
                          handleAction(workflow.id, action, data)
                        }
                      />
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </main>
      </AppShell>
    </ErrorBoundary>
  );
}
