"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SLACountdown } from "./SLACountdown";
import { apiRequest } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Workflow, WorkflowEvent } from "@/hooks/useWebSocket";
import {
  CheckCircle,
  AlertTriangle,
  UserCheck,
  MessageSquare,
  Clock,
  Globe,
  Brain,
  ChevronRight,
  Send,
  Loader2,
} from "lucide-react";

interface WorkflowDetailProps {
  workflow: Workflow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorityColors: Record<string, string> = {
  low: "#5a6e5f",
  medium: "#6b8cae",
  high: "#c9a84c",
  critical: "#c17767",
};

const eventIcons: Record<string, React.ReactNode> = {
  created: <Clock className="h-3.5 w-3.5" />,
  claimed: <UserCheck className="h-3.5 w-3.5" />,
  status_change: <ChevronRight className="h-3.5 w-3.5" />,
  escalated: <AlertTriangle className="h-3.5 w-3.5" />,
  resolved: <CheckCircle className="h-3.5 w-3.5" />,
  comment: <MessageSquare className="h-3.5 w-3.5" />,
  sla_breach: <AlertTriangle className="h-3.5 w-3.5 text-[var(--status-danger)]" />,
  reassigned: <ChevronRight className="h-3.5 w-3.5" />,
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
      return "Workflow created";
    case "claimed":
      return `Claimed by ${actorName}`;
    case "status_change":
      return `Status changed to ${(payload as Record<string, string>).status ?? "unknown"} by ${actorName}`;
    case "escalated":
      return `Escalated by ${actorName}`;
    case "resolved":
      return `Resolved by ${actorName}`;
    case "comment":
      return `${actorName}: ${(payload as Record<string, string>).text ?? ""}`;
    case "sla_breach":
      return "SLA deadline breached";
    case "reassigned":
      return `Reassigned by ${actorName}`;
    default:
      return event.eventType;
  }
}

export function WorkflowDetail({
  workflow,
  open,
  onOpenChange,
}: WorkflowDetailProps) {
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);

  // Fetch full detail with events when workflow changes
  const fetchDetail = async (id: string) => {
    try {
      const token = getToken();
      const detail = await apiRequest<{
        workflowEvents: WorkflowEvent[];
        aiClassification?: { confidence: number; summary: string } | null;
      }>(`/api/workflows/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setEvents(detail.workflowEvents ?? []);
      setEventsLoaded(true);
    } catch {
      setEvents([]);
    }
  };

  // Load events when a new workflow is selected
  if (workflow && open && !eventsLoaded) {
    fetchDetail(workflow.id);
  }

  // Reset when closing
  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setEventsLoaded(false);
      setEvents([]);
      setComment("");
    }
    onOpenChange(val);
  };

  const handleAction = async (action: string) => {
    if (!workflow) return;
    setLoading(action);

    try {
      const token = getToken();
      const headers = { Authorization: `Bearer ${token}` };

      switch (action) {
        case "claim":
          await apiRequest(`/api/workflows/${workflow.id}/claim`, {
            method: "POST",
            headers,
          });
          break;
        case "in_progress":
          await apiRequest(`/api/workflows/${workflow.id}/status`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: "in_progress" }),
          });
          break;
        case "resolve":
          await apiRequest(`/api/workflows/${workflow.id}/status`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ status: "resolved" }),
          });
          handleOpenChange(false);
          break;
        case "escalate":
          await apiRequest(`/api/workflows/${workflow.id}/escalate`, {
            method: "POST",
            headers,
          });
          break;
      }
      // Refresh events
      await fetchDetail(workflow.id);
    } catch (err) {
      console.error("Action failed:", err);
    } finally {
      setLoading(null);
    }
  };

  const handleComment = async () => {
    if (!workflow || !comment.trim()) return;
    setLoading("comment");

    try {
      const token = getToken();
      await apiRequest(`/api/workflows/${workflow.id}/comment`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: comment.trim() }),
      });
      setComment("");
      await fetchDetail(workflow.id);
    } catch (err) {
      console.error("Comment failed:", err);
    } finally {
      setLoading(null);
    }
  };

  const color = workflow ? priorityColors[workflow.priority] ?? priorityColors.medium : "#6b8cae";
  const roomId = workflow?.request?.roomId?.slice(-4).toUpperCase() ?? "---";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        data-testid="workflow-detail"
        side="right"
        className="w-full sm:w-[450px] sm:max-w-[90vw] h-full overflow-hidden border-l border-white/10 bg-[var(--bg-secondary)]/95 backdrop-blur-xl p-0"
      >
        {workflow && (
          <div className="flex h-full flex-col">
            {/* Header */}
            <SheetHeader className="border-b border-white/5 p-5">
              <div className="flex items-start justify-between gap-3 pr-6">
                <div>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider font-[family-name:var(--font-mono)]"
                      style={{ backgroundColor: `${color}20`, color }}
                    >
                      {workflow.priority.toUpperCase()}
                    </span>
                    <SheetTitle className="text-base">
                      Room {roomId}
                    </SheetTitle>
                  </div>
                  <SheetDescription className="text-xs">
                    {workflow.department?.name ?? "Unassigned"} &middot;{" "}
                    <span className="font-[family-name:var(--font-mono)]">
                      {workflow.status.replace("_", " ").toUpperCase()}
                    </span>
                  </SheetDescription>
                </div>

                {workflow.slaDeadline && (
                  <SLACountdown
                    deadline={new Date(workflow.slaDeadline)}
                    size="lg"
                  />
                )}
              </div>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="space-y-5 p-5">
                {/* Request details */}
                <section>
                  <h4 className="font-display mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                    Request Details
                  </h4>
                  <div className="space-y-2.5 rounded-lg border border-white/5 bg-white/[0.02] p-3.5">
                    {workflow.request?.originalText && (
                      <div>
                        <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                          <MessageSquare className="h-3 w-3" />
                          Original Text
                          {workflow.request.originalLang && (
                            <span className="ml-auto flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {workflow.request.originalLang.toUpperCase()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-[var(--text-primary)]">
                          {workflow.request.originalText}
                        </p>
                      </div>
                    )}

                    {workflow.request?.translated &&
                      workflow.request.translated !== workflow.request.originalText && (
                        <div className="border-t border-white/5 pt-2.5">
                          <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                            <Globe className="h-3 w-3" />
                            Translated
                          </div>
                          <p className="text-sm text-[var(--text-primary)]">
                            {workflow.request.translated}
                          </p>
                        </div>
                      )}

                    <div className="flex items-center gap-3 border-t border-white/5 pt-2.5">
                      <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                        <Brain className="h-3 w-3" />
                        AI Confidence
                      </div>
                      <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--accent,#d4a574)]">
                        85%
                      </span>
                    </div>
                  </div>
                </section>

                {/* Timeline */}
                <section>
                  <h4 className="font-display mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">
                    Timeline
                  </h4>
                  <div className="space-y-0">
                    <AnimatePresence>
                      {events.map((event, i) => (
                        <motion.div
                          key={event.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="relative flex gap-3 pb-3"
                        >
                          {/* Timeline line */}
                          {i < events.length - 1 && (
                            <div className="absolute left-[11px] top-6 h-full w-px bg-white/5" />
                          )}
                          {/* Icon */}
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/5 text-[var(--text-muted)]">
                            {eventIcons[event.eventType] ?? (
                              <Clock className="h-3.5 w-3.5" />
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

                    {events.length === 0 && eventsLoaded && (
                      <p className="py-4 text-center text-xs text-[var(--text-muted)]">
                        No events yet
                      </p>
                    )}
                    {!eventsLoaded && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-[var(--text-muted)]" />
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </ScrollArea>

            {/* Actions footer */}
            <div className="sticky bottom-0 border-t border-white/5 p-4 space-y-3 bg-[var(--bg-secondary)]/95 backdrop-blur-xl">
              {/* Comment input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                  className="bg-white/5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] border-white/10"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleComment}
                  disabled={!comment.trim() || loading === "comment"}
                  className="shrink-0 text-[var(--accent,#d4a574)] hover:bg-[var(--accent,#d4a574)]/10"
                >
                  {loading === "comment" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                {(workflow.status === "pending" || workflow.status === "escalated") && (
                  <Button
                    size="sm"
                    onClick={() => handleAction("claim")}
                    disabled={loading !== null}
                    className="bg-[var(--accent,#d4a574)] text-[var(--bg-primary)] hover:bg-[var(--accent,#d4a574)]/80 font-medium"
                  >
                    {loading === "claim" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Claim
                  </Button>
                )}

                {workflow.status === "claimed" && (
                  <Button
                    size="sm"
                    onClick={() => handleAction("in_progress")}
                    disabled={loading !== null}
                    className="bg-[var(--status-info,#6b8cae)] text-white hover:bg-[var(--status-info,#6b8cae)]/80 font-medium"
                  >
                    {loading === "in_progress" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronRight className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Start Work
                  </Button>
                )}

                {(workflow.status === "claimed" || workflow.status === "in_progress" || workflow.status === "escalated") && (
                  <Button
                    size="sm"
                    onClick={() => handleAction("resolve")}
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
                )}

                {workflow.status !== "escalated" && workflow.status !== "resolved" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction("escalate")}
                    disabled={loading !== null}
                    className="border-[var(--status-danger,#c17767)]/30 text-[var(--status-danger,#c17767)] hover:bg-[var(--status-danger,#c17767)]/10"
                  >
                    {loading === "escalate" ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Escalate
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
