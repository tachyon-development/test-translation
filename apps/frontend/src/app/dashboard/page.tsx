"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { Workflow } from "@/hooks/useWebSocket";
import { isAuthenticated } from "@/lib/auth";
import { ConnectionStatus } from "@/components/shared/ConnectionStatus";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { AppShell } from "@/components/shared/AppShell";
import { SkeletonKanban } from "@/components/shared/LoadingSkeleton";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { KanbanBoard } from "@/components/dashboard/KanbanBoard";
import { WorkflowDetail } from "@/components/dashboard/WorkflowDetail";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import type { FilterState } from "@/components/dashboard/DashboardFilters";
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from "lucide-react";

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

    const withSla = active.filter((w) => w.slaDeadline);
    const onTrack = withSla.filter(
      (w) => new Date(w.slaDeadline!).getTime() > Date.now()
    ).length;
    const slaCompliance = withSla.length > 0 ? Math.round((onTrack / withSla.length) * 100) : 100;

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

  // Connection status mapping
  const connStatus = connectionStatus === "connected"
    ? "connected" as const
    : connectionStatus === "reconnecting"
    ? "reconnecting" as const
    : "disconnected" as const;

  // Compute whether all queues are clear
  const allClear = connected && workflows.length === 0;

  if (!ready) {
    return <DashboardSkeleton />;
  }

  // Page-specific sidebar content
  const sidebarExtra = (
    <>
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
    </>
  );

  return (
    <ErrorBoundary>
      <AppShell
        activePage="dashboard"
        sidebarExtra={sidebarExtra}
        headerRight={<ConnectionStatus status={connStatus} />}
      >
        {/* Main content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Top bar */}
          <header className="flex items-center justify-between border-b border-white/5 px-4 py-3 md:px-6">
            <DashboardFilters
              filters={filters}
              onChange={setFilters}
              departments={departments}
            />
            <div className="hidden md:block">
              <ConnectionStatus status={connStatus} />
            </div>
          </header>

          {/* Kanban area */}
          <div className="flex-1 overflow-auto p-4 md:p-6">
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
      </AppShell>
    </ErrorBoundary>
  );
}
