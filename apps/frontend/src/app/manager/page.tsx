"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Workflow } from "@/hooks/useWebSocket";
import { getUser, getToken, clearToken, isAuthenticated } from "@/lib/auth";
import { apiRequest } from "@/lib/api";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { EscalationCard } from "@/components/manager/EscalationCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Loader2,
  TrendingDown,
} from "lucide-react";

// Sidebar nav — Manager page is active
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: false },
  { label: "Analytics", icon: BarChart3, href: "/analytics", active: false },
  { label: "Manager", icon: Users, href: "/manager", active: true },
  { label: "Admin", icon: Settings, href: "/admin", active: false },
];

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

  const user = getUser();
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
    // Refresh KPIs every 30s
    const interval = setInterval(fetchKpis, 30000);
    return () => clearInterval(interval);
  }, [ready]);

  // Filter to escalated workflows only, sorted by most overdue first
  const escalatedWorkflows = useMemo(() => {
    return workflows
      .filter((w) => w.status === "escalated" || w.escalated)
      .sort((a, b) => {
        // Most overdue first (earliest deadline first)
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

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

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

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar — identical to dashboard */}
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
              {/* Navigation */}
              <nav className="space-y-0.5">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => (item.active ? null : router.push(item.href))}
                    className={`
                      flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors
                      ${
                        item.active
                          ? "bg-[#c17767]/10 text-[#c17767]"
                          : "text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]"
                      }
                    `}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </nav>

              {/* Compact KPIs */}
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
            </div>
          </ScrollArea>

          {/* User info + logout */}
          <div className="border-t border-white/5 p-3">
            <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#c17767]/10 text-[10px] font-bold text-[#c17767]">
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
            <ConnectionStatus status={connStatus} />
          </header>

          {/* Escalation list */}
          <ScrollArea className="flex-1">
            <div className="p-6">
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
      </div>
    </ErrorBoundary>
  );
}
