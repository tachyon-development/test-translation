"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { SLACountdown } from "./SLACountdown";
import type { Workflow } from "@/hooks/useWebSocket";

interface WorkflowCardProps {
  workflow: Workflow;
  onClick: () => void;
  index?: number;
}

const priorityColors: Record<string, string> = {
  low: "var(--priority-low, #5a6e5f)",
  medium: "var(--priority-medium, #6b8cae)",
  high: "var(--priority-high, #c9a84c)",
  critical: "var(--priority-critical, #c17767)",
};

const priorityLabels: Record<string, string> = {
  low: "LOW",
  medium: "MED",
  high: "HIGH",
  critical: "CRIT",
};

/** SLA visual states based on remaining time ratio */
type SlaZone = "safe" | "warning" | "danger" | "overdue";

function getSlaZone(deadline: string | null): SlaZone {
  if (!deadline) return "safe";
  const remaining = new Date(deadline).getTime() - Date.now();
  if (remaining <= 0) return "overdue";
  // Estimate total SLA window — heuristic: assume 60 min if we can't calculate
  // A more precise ratio would require createdAt, but this gives directional accuracy
  const estimatedWindow = Math.max(remaining, 1) / 0.5; // assume we're ~midpoint at worst
  const ratio = remaining / estimatedWindow;
  if (ratio > 0.5) return "safe";
  if (ratio > 0.2) return "warning";
  return "danger";
}

const slaZoneBorderGlow: Record<SlaZone, string> = {
  safe: "shadow-[0_0_12px_rgba(124,152,133,0.15)]",      // sage green
  warning: "shadow-[0_0_14px_rgba(201,168,76,0.18)]",     // warm yellow
  danger: "shadow-[0_0_16px_rgba(193,119,103,0.2)]",      // coral
  overdue: "shadow-[0_0_20px_rgba(193,119,103,0.25)]",    // full coral
};

const slaZoneBorderColor: Record<SlaZone, string> = {
  safe: "rgba(124,152,133,0.3)",
  warning: "rgba(201,168,76,0.35)",
  danger: "rgba(193,119,103,0.35)",
  overdue: "rgba(193,119,103,0.5)",
};

function getRoomNumber(workflow: Workflow): string {
  if (workflow.request?.originalText) {
    // Try to extract room number from text context — fallback to request ID snippet
  }
  return workflow.request?.roomId?.slice(-4).toUpperCase() ?? "---";
}

export function WorkflowCard({ workflow, onClick, index = 0 }: WorkflowCardProps) {
  const color = priorityColors[workflow.priority] ?? priorityColors.medium;
  const isCritical = workflow.priority === "critical";
  const isEscalated = workflow.status === "escalated" || workflow.escalated;
  const summary =
    workflow.request?.translated ||
    workflow.request?.originalText ||
    "No description available";
  const confidence = workflow.aiClassification?.confidence ?? 0.85;

  const slaZone = useMemo(
    () => getSlaZone(workflow.slaDeadline),
    [workflow.slaDeadline]
  );
  const isOverdue = slaZone === "overdue";

  // Determine border color: escalated uses coral, otherwise priority color
  const leftBorderColor = isEscalated ? "#c17767" : color;

  return (
    <motion.div
      layout
      layoutId={workflow.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{
        opacity: 1,
        y: 0,
        // Shake animation on escalation (3 cycles, subtle)
        ...(isEscalated
          ? { x: [0, -1.5, 1.5, -1.5, 1.5, -1, 1, 0] }
          : {}),
      }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 30,
        delay: index * 0.05,
        x: { duration: 0.5, delay: index * 0.05 + 0.1 },
      }}
      onClick={onClick}
      className={`
        group relative cursor-pointer overflow-hidden rounded-xl
        border backdrop-blur-sm
        transition-all duration-300 hover:border-white/20 hover:bg-[var(--bg-elevated,#222238)]
        ${isOverdue
          ? "bg-red-900/5 border-[#c17767]/40"
          : isEscalated
            ? "bg-[#c17767]/[0.03] border-[#c17767]/20"
            : "border-white/10 bg-[var(--bg-elevated,#222238)]/80"
        }
        ${slaZoneBorderGlow[slaZone]}
        ${isCritical && !isEscalated ? "shadow-[0_0_20px_rgba(193,119,103,0.15)]" : ""}
      `}
      style={{
        borderLeftWidth: isEscalated ? 4 : 3,
        borderLeftColor: leftBorderColor,
        borderColor: isOverdue || isEscalated
          ? undefined  // use className border color
          : undefined,
      }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* SLA-based pulse glow: danger and overdue states */}
      {(slaZone === "danger" || isOverdue) && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{
            boxShadow: isOverdue
              ? [
                  "0 0 0px rgba(193,119,103,0)",
                  "0 0 20px rgba(193,119,103,0.25)",
                  "0 0 0px rgba(193,119,103,0)",
                ]
              : [
                  "0 0 0px rgba(193,119,103,0)",
                  "0 0 12px rgba(193,119,103,0.15)",
                  "0 0 0px rgba(193,119,103,0)",
                ],
          }}
          transition={{
            duration: isOverdue ? 1.5 : 2.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}

      {/* Critical pulse glow (non-escalated critical cards keep their own glow) */}
      {isCritical && !isEscalated && slaZone !== "danger" && !isOverdue && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{
            boxShadow: [
              "0 0 0px rgba(193,119,103,0)",
              "0 0 15px rgba(193,119,103,0.2)",
              "0 0 0px rgba(193,119,103,0)",
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="relative p-3.5">
        {/* Top: Priority badge + Escalated badge + Room */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider font-[family-name:var(--font-mono)]"
              style={{
                backgroundColor: `${color}20`,
                color,
              }}
            >
              {priorityLabels[workflow.priority] ?? "MED"}
            </span>
            {isEscalated && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, type: "spring", stiffness: 400 }}
                className="rounded bg-[#c17767]/15 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-[#c17767] font-[family-name:var(--font-mono)]"
              >
                ESCALATED
              </motion.span>
            )}
          </div>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            Rm {getRoomNumber(workflow)}
          </span>
        </div>

        {/* Middle: Summary */}
        <p className="mb-3 line-clamp-2 text-sm leading-snug text-[var(--text-primary)]">
          {summary}
        </p>

        {/* Bottom: SLA + Department + Confidence */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {workflow.slaDeadline && (
              <SLACountdown deadline={new Date(workflow.slaDeadline)} size="sm" />
            )}
            {workflow.department && (
              <span className="hidden sm:inline text-[10px] text-[var(--text-muted)]">
                {workflow.department.name}
              </span>
            )}
          </div>
          <span className="hidden sm:inline text-[10px] font-[family-name:var(--font-mono)] text-[var(--text-muted)]">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
