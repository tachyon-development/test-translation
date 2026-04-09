"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Workflow } from "@/hooks/useWebSocket";
import { getUser, clearToken, isAuthenticated } from "@/lib/auth";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { SkeletonKanban } from "@/components/shared/LoadingSkeleton";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { WorkflowDetail } from "@/components/dashboard/WorkflowDetail";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import type { FilterState } from "@/components/dashboard/DashboardFilters";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// Sidebar nav items
const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", active: true },
  { label: "Analytics", icon: BarChart3, href: "/analytics", active: false },
  { label: "Manager", icon: Users, href: "/manager", active: false },
  { label: "Admin", icon: Settings, href: "/admin", active: false },
];

export default function DashboardPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  // Auth check
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  const user = getUser();
  const { workflows, connected, connectionStatus } = useWebSocket();

  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    department: "all",
    priority: "all",
    search: "",
  });

  // Derive unique departments from workflows
  const departments = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const w of workflows) {
      if (w.department) {
        map.set(w.department.id, { id: w.department.id, name: w.department.name });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [workflows]);

  // Apply filters
  const filteredWorkflows = useMemo(() => {
    return workflows.filter((w) => {
      if (filters.department !== "all" && w.departmentId !== filters.department) return false;
      if (filters.priority !== "all" && w.priority !== filters.priority) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const roomMatch = w.request?.roomId?.toLowerCase().includes(q);
        const textMatch = w.request?.originalText?.toLowerCase().includes(q);
        const translatedMatch = w.request?.translated?.toLowerCase().includes(q);
        if (!roomMatch && !textMatch && !translatedMatch) return false;
      }
      return true;
    });
  }, [workflows, filters]);

  // Sidebar stats
  const stats = useMemo(() => {
    const active = workflows.filter(
      (w) => w.status !== "resolved" && w.status !== "cancelled"
    );
    const pending = active.filter((w) => w.status === "pending").length;
    const escalated = active.filter((w) => w.status === "escalated").length;
    const total = active.length;

    // SLA compliance: resolved within SLA / total resolved (approximate from active data)
    // Since we don't have resolved workflows in WS state, show active SLA health
    const withSla = active.filter((w) => w.slaDeadline);
    const onTrack = withSla.filter(
      (w) => new Date(w.slaDeadline!).getTime() > Date.now()
    ).length;
    const slaCompliance = withSla.length > 0 ? Math.round((onTrack / withSla.length) * 100) : 100;

    // Department counts
    const deptCounts = new Map<string, number>();
    for (const w of active) {
      if (w.department) {
        deptCounts.set(w.department.name, (deptCounts.get(w.department.name) ?? 0) + 1);
      }
    }

    return { total, pending, escalated, slaCompliance, deptCounts };
  }, [workflows]);

  const handleCardClick = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setDetailOpen(true);
  };

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  // Connection status mapping
  const connStatus = connectionStatus === "connected"
    ? "connected" as const
    : connectionStatus === "reconnecting"
    ? "reconnecting" as const
    : "disconnected" as const;

  // Compute whether all queues are clear (connected, have loaded, but no active workflows)
  const allClear =
    connected &&
    workflows.length === 0;

  if (!ready) {
    return <DashboardSkeleton />;
  }

  return (
    <ErrorBoundary>
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
              {/* Navigation */}
              <nav className="space-y-0.5">
                {navItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => item.active ? null : router.push(item.href)}
                    className={`
                      flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors
                      ${item.active
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

              {/* Stats section */}
              <div className="mt-6 border-t border-white/5 pt-4">
                <h3 className="font-display mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Queue Overview
                </h3>

                <div className="space-y-2 px-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Clock className="h-3 w-3" />
                      Total Active
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--text-primary)]">
                      {stats.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <AlertTriangle className="h-3 w-3 text-[var(--status-danger,#c17767)]" />
                      Escalated
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--status-danger,#c17767)]">
                      {stats.escalated}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <CheckCircle2 className="h-3 w-3 text-[var(--status-success,#7c9885)]" />
                      SLA On Track
                    </span>
                    <span className="font-[family-name:var(--font-mono)] text-sm font-bold text-[var(--status-success,#7c9885)]">
                      {stats.slaCompliance}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Departments */}
              <div className="mt-5 border-t border-white/5 pt-4">
                <h3 className="font-display mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                  Departments
                </h3>
                <div className="space-y-0.5">
                  {departments.map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          department: f.department === dept.id ? "all" : dept.id,
                        }))
                      }
                      className={`
                        flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors
                        ${filters.department === dept.id
                          ? "bg-[var(--accent,#d4a574)]/10 text-[var(--accent,#d4a574)]"
                          : "text-[var(--text-secondary)] hover:bg-white/5"
                        }
                      `}
                    >
                      {dept.name}
                      <span className="font-[family-name:var(--font-mono)] text-[10px]">
                        {stats.deptCounts.get(dept.name) ?? 0}
                      </span>
                    </button>
                  ))}
                  {departments.length === 0 && (
                    <p className="px-3 text-[10px] text-[var(--text-muted)]">
                      No departments yet
                    </p>
                  )}
                </div>
              </div>
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
            <DashboardFilters
              filters={filters}
              onChange={setFilters}
              departments={departments}
            />
            <ConnectionStatus status={connStatus} />
          </header>

          {/* Kanban area */}
          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              {!connected && workflows.length === 0 ? (
                <motion.div
                  key="skeleton"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <SkeletonKanban />
                </motion.div>
              ) : allClear ? (
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
                    All clear — no pending requests
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Your department is caught up. Nice work.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="board"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <KanbanBoard
                    workflows={filteredWorkflows}
                    onCardClick={handleCardClick}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Detail panel */}
        <WorkflowDetail
          workflow={selectedWorkflow}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      </div>
    </ErrorBoundary>
  );
}
