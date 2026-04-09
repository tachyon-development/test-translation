"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SLACountdown } from "@/components/dashboard/SLACountdown";
import { ClassificationOverride } from "./ClassificationOverride";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Workflow, WorkflowEvent } from "@/hooks/useWebSocket";
import {
  AlertTriangle,
  Clock,
  UserCheck,
  CheckCircle,
  MessageSquare,
  ChevronRight,
  Brain,
  Globe,
  Loader2,
  Send,
  ArrowRightLeft,
  Shield,
  StickyNote,
} from "lucide-react";

// Mock staff list for reassignment
const STAFF_OPTIONS = [
  { id: "staff-1", name: "Maria Gonzalez" },
  { id: "staff-2", name: "James Chen" },
  { id: "staff-3", name: "Aisha Patel" },
  { id: "staff-4", name: "Carlos Rivera" },
  { id: "staff-5", name: "Yuki Tanaka" },
];

interface EscalationCardProps {
  workflow: Workflow;
  onAction: (action: string, data?: Record<string, unknown>) => Promise<void>;
}

const eventIcons: Record<string, React.ReactNode> = {
  created: <Clock className="h-3 w-3" />,
  claimed: <UserCheck className="h-3 w-3" />,
  status_change: <ChevronRight className="h-3 w-3" />,
  escalated: <AlertTriangle className="h-3 w-3 text-[#c17767]" />,
  resolved: <CheckCircle className="h-3 w-3" />,
  comment: <MessageSquare className="h-3 w-3" />,
  sla_breach: <AlertTriangle className="h-3 w-3 text-[#c17767]" />,
  reassigned: <ArrowRightLeft className="h-3 w-3" />,
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getEventDescription(event: WorkflowEvent): string {
  const actorName = event.actor?.name ?? "System";
  const payload = event.payload ?? {};

  switch (event.eventType) {
    case "created":
      return "Workflow created (auto)";
    case "claimed":
      return `Claimed by ${actorName}`;
    case "status_change":
      return `Status \u2192 ${(payload as Record<string, string>).status ?? "unknown"}`;
    case "escalated":
      return `Escalated \u2192 ${actorName} (mgr)`;
    case "resolved":
      return `Resolved by ${actorName}`;
    case "comment":
      return `${actorName}: ${(payload as Record<string, string>).text ?? ""}`;
    case "sla_breach":
      return `SLA breached (${(payload as Record<string, string>).sla_minutes ?? "?"}min)`;
    case "reassigned":
      return `Reassigned by ${actorName}`;
    default:
      return event.eventType;
  }
}

function getOverdueMinutes(workflow: Workflow): number | null {
  if (!workflow.slaDeadline) return null;
  const diff = Date.now() - new Date(workflow.slaDeadline).getTime();
  if (diff <= 0) return null;
  return Math.floor(diff / 60000);
}

export function EscalationCard({ workflow, onAction }: EscalationCardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reassignOpen, setReassignOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [commentText, setCommentText] = useState("");

  const overdueMin = getOverdueMinutes(workflow);
  const roomId = workflow.request?.roomId?.slice(-4).toUpperCase() ?? "---";
  const deptName = workflow.department?.name ?? "Unassigned";
  const summary =
    workflow.request?.translated ||
    workflow.request?.originalText ||
    "No description available";
  const originalText = workflow.request?.originalText ?? null;
  const translated = workflow.request?.translated ?? null;
  const showTranslation =
    translated && originalText && translated !== originalText;
  const confidence = workflow.aiClassification?.confidence
    ? Math.round(workflow.aiClassification.confidence * 100)
    : 85;
  const aiCategory = workflow.aiClassification?.aiCategory ?? deptName.toLowerCase();
  const aiUrgency = workflow.aiClassification?.urgency ?? workflow.priority;
  const events = workflow.workflowEvents ?? [];

  const handleAction = async (action: string, data?: Record<string, unknown>) => {
    setLoading(action);
    try {
      await onAction(action, data);
    } catch {
      // Errors handled by parent
    } finally {
      setLoading(null);
    }
  };

  return (
    <>
      <motion.div
        layout
        layoutId={`escalation-${workflow.id}`}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{
          opacity: 1,
          y: 0,
          scale: 1,
          x: [0, -2, 2, -2, 2, -1, 1, 0], // shake on mount
        }}
        exit={{ opacity: 0, y: -10 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 28,
          x: { duration: 0.5, delay: 0.1 },
        }}
        className="relative overflow-hidden rounded-xl border border-[#c17767]/20 bg-[var(--bg-elevated,#222238)]/80 backdrop-blur-sm"
        style={{ borderLeftWidth: 4, borderLeftColor: "#c17767" }}
      >
        {/* Coral accent glow */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{
            boxShadow: [
              "0 0 0px rgba(193,119,103,0)",
              "0 0 20px rgba(193,119,103,0.12)",
              "0 0 0px rgba(193,119,103,0)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative p-5">
          {/* Header: ESCALATED badge + overdue time */}
          <div className="mb-4 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="rounded-md bg-[#c17767]/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-[#c17767] font-[family-name:var(--font-mono)]"
              >
                ESCALATED
                {overdueMin !== null && (
                  <span className="ml-1.5">
                    &mdash; {overdueMin}min overdue
                  </span>
                )}
              </motion.span>
            </div>
            {workflow.slaDeadline && (
              <SLACountdown
                deadline={new Date(workflow.slaDeadline)}
                size="lg"
              />
            )}
          </div>

          {/* Room + Department */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-semibold text-[var(--text-primary)]">
              Rm {roomId}
            </span>
            <span className="text-[var(--text-muted)]">&middot;</span>
            <span className="text-sm text-[var(--text-secondary)]">
              {deptName}
            </span>
          </div>

          {/* Request summary */}
          <div className="mb-4 rounded-lg border border-white/5 bg-white/[0.02] p-3.5">
            {originalText && (
              <div className="mb-2">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <MessageSquare className="h-3 w-3" />
                  Original
                  {workflow.request?.originalLang && (
                    <span className="ml-auto flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {workflow.request.originalLang.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  &ldquo;{originalText}&rdquo;
                </p>
              </div>
            )}
            {showTranslation && (
              <div className="border-t border-white/5 pt-2">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                  <Globe className="h-3 w-3" />
                  Translated
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">
                  {translated}
                </p>
              </div>
            )}
            {!showTranslation && !originalText && (
              <p className="text-sm text-[var(--text-primary)]">{summary}</p>
            )}
          </div>

          {/* AI Classification info */}
          <div className="mb-4 flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
              <Brain className="h-3.5 w-3.5 text-[var(--accent,#d4a574)]" />
              <span>AI: {aiCategory}</span>
            </div>
            <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--accent,#d4a574)]">
              {confidence}% conf
            </span>
            <span className="text-[10px] text-[var(--text-muted)]">
              urgency: {aiUrgency}
            </span>
          </div>

          {/* Action buttons */}
          <div className="mb-5 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOverrideOpen(true)}
              disabled={loading !== null}
              className="border-[#c17767]/30 text-[#c17767] hover:bg-[#c17767]/10 font-medium"
            >
              <Shield className="mr-1.5 h-3.5 w-3.5" />
              Override Dept
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setReassignOpen(true)}
              disabled={loading !== null}
              className="border-white/10 text-[var(--text-secondary)] hover:bg-white/5 font-medium"
            >
              <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
              Reassign
            </Button>

            <Button
              size="sm"
              onClick={() => setResolveOpen(true)}
              disabled={loading !== null}
              className="bg-[var(--status-success,#7c9885)] text-white hover:bg-[var(--status-success,#7c9885)]/80 font-medium"
            >
              {loading === "resolve" ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Resolve
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setNoteOpen(true)}
              disabled={loading !== null}
              className="border-white/10 text-[var(--text-secondary)] hover:bg-white/5 font-medium"
            >
              <StickyNote className="mr-1.5 h-3.5 w-3.5" />
              Add Note
            </Button>
          </div>

          {/* Event Timeline */}
          {events.length > 0 && (
            <div>
              <h4 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                Timeline
              </h4>
              <div className="space-y-0">
                <AnimatePresence>
                  {events.map((event, i) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="relative flex gap-2.5 pb-2.5"
                    >
                      {/* Timeline line */}
                      {i < events.length - 1 && (
                        <div className="absolute left-[9px] top-5 h-full w-px bg-white/5" />
                      )}
                      {/* Icon */}
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                          event.eventType === "escalated" || event.eventType === "sla_breach"
                            ? "bg-[#c17767]/15 text-[#c17767]"
                            : "bg-white/5 text-[var(--text-muted)]"
                        }`}
                      >
                        {eventIcons[event.eventType] ?? (
                          <Clock className="h-3 w-3" />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                          {getEventDescription(event)}
                        </p>
                        <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                          {formatTimestamp(event.createdAt)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Classification Override Dialog */}
      <ClassificationOverride
        workflow={workflow}
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        onSubmit={async (data) => {
          await handleAction("override", data);
        }}
      />

      {/* Reassign Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-sm border-white/10 bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              Reassign Workflow
            </DialogTitle>
            <DialogDescription>
              Assign this workflow to a different staff member.
            </DialogDescription>
          </DialogHeader>
          <Select value={reassignTo} onValueChange={setReassignTo}>
            <SelectTrigger className="bg-white/5 border-white/10 text-[var(--text-primary)]">
              <SelectValue placeholder="Select staff member..." />
            </SelectTrigger>
            <SelectContent>
              {STAFF_OPTIONS.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setReassignOpen(false)}
              className="text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!reassignTo) return;
                await handleAction("reassign", { assignTo: reassignTo });
                setReassignOpen(false);
                setReassignTo("");
              }}
              disabled={!reassignTo || loading === "reassign"}
              className="bg-[var(--accent,#d4a574)] text-[var(--bg-primary)] hover:bg-[var(--accent,#d4a574)]/80 font-medium"
            >
              {loading === "reassign" && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-sm border-white/10 bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              Resolve Workflow
            </DialogTitle>
            <DialogDescription>
              Add a resolution note and close this escalation.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={resolutionNote}
            onChange={(e) => setResolutionNote(e.target.value)}
            placeholder="Describe the resolution..."
            rows={3}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--status-success,#7c9885)]/50 resize-none"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setResolveOpen(false)}
              className="text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await handleAction("resolve", { note: resolutionNote.trim() });
                setResolveOpen(false);
                setResolutionNote("");
              }}
              disabled={loading === "resolve"}
              className="bg-[var(--status-success,#7c9885)] text-white hover:bg-[var(--status-success,#7c9885)]/80 font-medium"
            >
              {loading === "resolve" && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Note Dialog */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm border-white/10 bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--text-primary)]">
              Add Note
            </DialogTitle>
            <DialogDescription>
              Add a comment to this workflow&apos;s timeline.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Write a note..."
            rows={3}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent,#d4a574)]/50 resize-none"
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setNoteOpen(false)}
              className="text-[var(--text-secondary)]"
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!commentText.trim()) return;
                await handleAction("comment", { text: commentText.trim() });
                setNoteOpen(false);
                setCommentText("");
              }}
              disabled={!commentText.trim() || loading === "comment"}
              className="bg-[var(--accent,#d4a574)] text-[var(--bg-primary)] hover:bg-[var(--accent,#d4a574)]/80 font-medium"
            >
              {loading === "comment" && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
