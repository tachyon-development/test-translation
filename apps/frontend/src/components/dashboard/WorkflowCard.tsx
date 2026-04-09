"use client";

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

function getRoomNumber(workflow: Workflow): string {
  if (workflow.request?.originalText) {
    // Try to extract room number from text context — fallback to request ID snippet
  }
  return workflow.request?.roomId?.slice(-4).toUpperCase() ?? "---";
}

export function WorkflowCard({ workflow, onClick, index = 0 }: WorkflowCardProps) {
  const color = priorityColors[workflow.priority] ?? priorityColors.medium;
  const isCritical = workflow.priority === "critical";
  const summary =
    workflow.request?.translated ||
    workflow.request?.originalText ||
    "No description available";
  const confidence = 0.85; // Will come from aiClassification when available

  return (
    <motion.div
      layout
      layoutId={workflow.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.2 } }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 30,
        delay: index * 0.05,
      }}
      onClick={onClick}
      className={`
        group relative cursor-pointer overflow-hidden rounded-xl
        border border-white/10 bg-[var(--bg-elevated,#222238)]/80 backdrop-blur-sm
        transition-all duration-200 hover:border-white/20 hover:bg-[var(--bg-elevated,#222238)]
        ${isCritical ? "shadow-[0_0_20px_rgba(193,119,103,0.15)]" : ""}
      `}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Critical pulse glow */}
      {isCritical && (
        <motion.div
          className="absolute inset-0 rounded-xl"
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
        {/* Top: Priority badge + Room */}
        <div className="mb-2 flex items-center justify-between">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider font-[family-name:var(--font-mono)]"
            style={{
              backgroundColor: `${color}20`,
              color,
            }}
          >
            {priorityLabels[workflow.priority] ?? "MED"}
          </span>
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
              <span className="text-[10px] text-[var(--text-muted)]">
                {workflow.department.name}
              </span>
            )}
          </div>
          <span className="text-[10px] font-[family-name:var(--font-mono)] text-[var(--text-muted)]">
            {Math.round(confidence * 100)}%
          </span>
        </div>
      </div>
    </motion.div>
  );
}
