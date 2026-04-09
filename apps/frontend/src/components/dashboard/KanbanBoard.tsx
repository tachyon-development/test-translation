"use client";

import { AnimatePresence, motion } from "framer-motion";
import { WorkflowCard } from "./WorkflowCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { Inbox, HelpCircle } from "lucide-react";
import { useState } from "react";
import type { Workflow } from "@/hooks/useWebSocket";

interface KanbanBoardProps {
  workflows: Workflow[];
  onCardClick: (workflow: Workflow) => void;
}

type ColumnKey = "pending" | "claimed" | "in_progress" | "escalated";

interface Column {
  key: ColumnKey;
  label: string;
  accentClass: string;
  description: string;
}

const columns: Column[] = [
  { key: "pending", label: "Pending", accentClass: "text-[var(--status-pending,#8a7fb5)]", description: "New requests waiting to be picked up by staff. AI has classified and routed them to the correct department." },
  { key: "claimed", label: "Claimed", accentClass: "text-[var(--status-info,#6b8cae)]", description: "A staff member has claimed this request and is preparing to handle it. The guest has been notified." },
  { key: "in_progress", label: "In Progress", accentClass: "text-[var(--status-warning,#c9a84c)]", description: "Staff is actively working on resolving this request. The guest can see the real-time status." },
  { key: "escalated", label: "Escalated", accentClass: "text-[var(--status-danger,#c17767)]", description: "SLA deadline was missed. This has been escalated to a manager for immediate attention." },
];

const priorityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortWorkflows(workflows: Workflow[]): Workflow[] {
  return [...workflows].sort((a, b) => {
    // Sort by priority first (critical first)
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    // Then by SLA deadline (soonest first)
    if (a.slaDeadline && b.slaDeadline) {
      return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
    }
    if (a.slaDeadline) return -1;
    if (b.slaDeadline) return 1;

    return 0;
  });
}

export function KanbanBoard({ workflows, onCardClick }: KanbanBoardProps) {
  const grouped: Record<ColumnKey, Workflow[]> = {
    pending: [],
    claimed: [],
    in_progress: [],
    escalated: [],
  };

  for (const w of workflows) {
    if (w.status in grouped) {
      grouped[w.status as ColumnKey].push(w);
    }
  }

  return (
    <div data-testid="kanban-board" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {columns.map((col) => {
        const items = sortWorkflows(grouped[col.key]);
        const isEscalated = col.key === "escalated";

        return (
          <div key={col.key} className="flex flex-col">
            {/* Column header */}
            <div
              className={`mb-3 flex items-center gap-2 ${isEscalated ? "rounded-lg bg-[var(--status-danger,#c17767)]/5 px-2 py-1.5 -mx-2" : ""}`}
            >
              <h3
                className={`font-display text-sm font-semibold tracking-wide ${col.accentClass}`}
              >
                {col.label}
              </h3>
              <div className="group relative">
                <HelpCircle className="h-3.5 w-3.5 cursor-help text-[var(--text-secondary)] opacity-40 hover:opacity-80 transition-opacity" />
                <div className="pointer-events-none absolute left-1/2 top-full z-50 mt-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-[var(--bg-elevated)] p-3 text-xs text-[var(--text-secondary)] opacity-0 shadow-xl backdrop-blur-xl transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                  <p className="font-sans font-normal leading-relaxed">{col.description}</p>
                </div>
              </div>
              <span
                className={`
                  inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5
                  text-[10px] font-bold font-[family-name:var(--font-mono)]
                  ${isEscalated && items.length > 0
                    ? "bg-[var(--status-danger,#c17767)]/20 text-[var(--status-danger,#c17767)]"
                    : "bg-white/5 text-[var(--text-muted)]"
                  }
                `}
              >
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2.5">
              <AnimatePresence mode="popLayout">
                {items.map((workflow, i) => (
                  <WorkflowCard
                    key={workflow.id}
                    workflow={workflow}
                    onClick={() => onCardClick(workflow)}
                    index={i}
                  />
                ))}
              </AnimatePresence>

              {items.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-white/5 py-12"
                >
                  <div className="text-center">
                    <Inbox className="mx-auto mb-2 h-5 w-5 text-[var(--text-muted)]/50" />
                    <p className="text-xs text-[var(--text-muted)]/50">
                      No tasks
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
