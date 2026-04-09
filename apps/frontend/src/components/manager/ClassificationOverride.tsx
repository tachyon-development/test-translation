"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowRight } from "lucide-react";
import type { Workflow } from "@/hooks/useWebSocket";

const DEPARTMENTS = [
  { id: "housekeeping", name: "Housekeeping" },
  { id: "maintenance", name: "Maintenance" },
  { id: "front-desk", name: "Front Desk" },
  { id: "concierge", name: "Concierge" },
  { id: "food-beverage", name: "Food & Beverage" },
  { id: "security", name: "Security" },
  { id: "valet", name: "Valet" },
  { id: "spa", name: "Spa & Wellness" },
];

const PRIORITIES: { value: Workflow["priority"]; label: string; color: string }[] = [
  { value: "low", label: "Low", color: "#5a6e5f" },
  { value: "medium", label: "Medium", color: "#6b8cae" },
  { value: "high", label: "High", color: "#c9a84c" },
  { value: "critical", label: "Critical", color: "#c17767" },
];

interface ClassificationOverrideProps {
  workflow: Workflow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    departmentId: string;
    priority: Workflow["priority"];
    reason: string;
  }) => Promise<void>;
}

export function ClassificationOverride({
  workflow,
  open,
  onOpenChange,
  onSubmit,
}: ClassificationOverrideProps) {
  const [departmentId, setDepartmentId] = useState(workflow.departmentId ?? "");
  const [priority, setPriority] = useState<Workflow["priority"]>(workflow.priority);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const currentDeptName =
    workflow.department?.name ?? "Unassigned";
  const currentConfidence =
    workflow.aiClassification?.confidence
      ? Math.round(workflow.aiClassification.confidence * 100)
      : null;
  const currentCategory = workflow.aiClassification?.aiCategory ?? null;

  const handleSubmit = async () => {
    if (!departmentId || !reason.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ departmentId, priority, reason: reason.trim() });
      onOpenChange(false);
      setReason("");
    } catch {
      // Error handled by caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-[#c17767]/20 bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--text-primary)]">
            Override AI Classification
          </DialogTitle>
          <DialogDescription>
            Override the AI-assigned department and priority for this workflow.
          </DialogDescription>
        </DialogHeader>

        {/* Current AI classification */}
        <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
            Current AI Classification
          </p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Department</span>
              <span className="font-medium text-[var(--text-primary)]">
                {currentDeptName}
              </span>
            </div>
            {currentCategory && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Category</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {currentCategory}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[var(--text-secondary)]">Priority</span>
              <span
                className="font-[family-name:var(--font-mono)] text-xs font-bold"
                style={{
                  color:
                    PRIORITIES.find((p) => p.value === workflow.priority)?.color ??
                    "#6b8cae",
                }}
              >
                {workflow.priority.toUpperCase()}
              </span>
            </div>
            {currentConfidence !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-secondary)]">Confidence</span>
                <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--accent,#d4a574)]">
                  {currentConfidence}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <ArrowRight className="h-4 w-4 rotate-90 text-[#c17767]" />
        </div>

        {/* Override fields */}
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              New Department
            </label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="bg-white/5 border-white/10 text-[var(--text-primary)]">
                <SelectValue placeholder="Select department..." />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              New Priority
            </label>
            <Select
              value={priority}
              onValueChange={(v) => setPriority(v as Workflow["priority"])}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-[var(--text-primary)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--text-secondary)]">
              Reason for Override
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why the AI classification is incorrect..."
              rows={3}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#c17767]/50 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-[var(--text-secondary)]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!departmentId || !reason.trim() || submitting}
            className="bg-[#c17767] text-white hover:bg-[#c17767]/80 font-medium"
          >
            {submitting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : null}
            Apply Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
