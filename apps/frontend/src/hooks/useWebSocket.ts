"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getToken } from "@/lib/auth";

export interface Department {
  id: string;
  name: string;
  slug: string;
  slaConfig: Record<string, number>;
}

export interface Request {
  id: string;
  originalText: string | null;
  originalLang: string | null;
  translated: string | null;
  roomId: string | null;
  status: string;
  createdAt: string;
}

export interface AiClassification {
  id: string;
  requestId: string;
  model: string;
  aiCategory: string;
  summary: string;
  confidence: number;
  urgency: string;
}

export interface WorkflowEvent {
  id: string;
  workflowId: string;
  actorId: string | null;
  eventType: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name: string; role: string } | null;
}

export interface Workflow {
  id: string;
  requestId: string;
  orgId: string;
  departmentId: string | null;
  assignedTo: string | null;
  priority: "low" | "medium" | "high" | "critical";
  slaDeadline: string | null;
  escalated: boolean;
  escalatedTo: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  resolutionNote: string | null;
  status: "pending" | "claimed" | "in_progress" | "escalated" | "resolved" | "cancelled";
  createdAt: string;
  department: Department | null;
  request: Request | null;
  aiClassification?: AiClassification | null;
  workflowEvents?: WorkflowEvent[];
}

type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

interface WSMessage {
  type: string;
  workflows?: Workflow[];
  workflow?: Workflow;
  workflowId?: string;
  assignedTo?: string;
  status?: string;
  [key: string]: unknown;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const MAX_RETRIES = 10;
const BASE_DELAY = 1000;
const PING_INTERVAL = 30_000;

export function useWebSocket() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const retriesRef = useRef(0);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connected = connectionStatus === "connected";

  const cleanup = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token) {
      setConnectionStatus("disconnected");
      return;
    }

    cleanup();
    setConnectionStatus("connecting");

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsBase = API_BASE
      ? API_BASE.replace(/^https?:/, wsProtocol)
      : `${wsProtocol}//${window.location.host}`;
    const ws = new WebSocket(`${wsBase}/ws/dashboard?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
      retriesRef.current = 0;

      // Start ping interval
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data);

        switch (msg.type) {
          case "snapshot":
            if (msg.workflows) {
              setWorkflows(msg.workflows);
            }
            break;

          case "workflow.created":
            if (msg.workflow) {
              setWorkflows((prev) => {
                // Avoid duplicates
                const exists = prev.some((w) => w.id === msg.workflow!.id);
                if (exists) return prev;
                return [msg.workflow!, ...prev];
              });
            }
            break;

          case "workflow.claimed":
            setWorkflows((prev) =>
              prev.map((w) =>
                w.id === msg.workflowId
                  ? { ...w, status: "claimed" as const, assignedTo: msg.assignedTo ?? w.assignedTo }
                  : w
              )
            );
            break;

          case "workflow.in_progress":
            setWorkflows((prev) =>
              prev.map((w) =>
                w.id === msg.workflowId
                  ? { ...w, status: "in_progress" as const }
                  : w
              )
            );
            break;

          case "workflow.escalated":
            setWorkflows((prev) =>
              prev.map((w) =>
                w.id === msg.workflowId
                  ? { ...w, status: "escalated" as const, escalated: true }
                  : w
              )
            );
            break;

          case "workflow.resolved":
            setWorkflows((prev) =>
              prev.filter((w) => w.id !== msg.workflowId)
            );
            break;

          case "workflow.reassigned":
            if (msg.workflowId) {
              setWorkflows((prev) =>
                prev.map((w) =>
                  w.id === msg.workflowId
                    ? {
                        ...w,
                        departmentId: (msg.department_id as string) ?? w.departmentId,
                        priority: (msg.priority as Workflow["priority"]) ?? w.priority,
                      }
                    : w
                )
              );
            }
            break;

          case "pong":
            // Heartbeat acknowledged
            break;
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onerror = () => {
      // onclose will handle reconnection
    };

    ws.onclose = () => {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (retriesRef.current < MAX_RETRIES) {
        setConnectionStatus("reconnecting");
        const delay = Math.min(BASE_DELAY * Math.pow(2, retriesRef.current), 30_000);
        retriesRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setConnectionStatus("disconnected");
      }
    };
  }, [cleanup]);

  useEffect(() => {
    connect();
    return cleanup;
  }, [connect, cleanup]);

  return { workflows, connected, connectionStatus, reconnect: connect };
}
