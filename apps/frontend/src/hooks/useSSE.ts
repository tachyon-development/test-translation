"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface SSEEvent {
  type: string;
  step?: string;
  assignedTo?: string;
  message?: string;
  timestamp?: string;
  [key: string]: unknown;
}

interface UseSSEReturn {
  events: SSEEvent[];
  latestEvent: SSEEvent | null;
  connected: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;

export function useSSE(requestId: string | null): UseSSEReturn {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [latestEvent, setLatestEvent] = useState<SSEEvent | null>(null);
  const [connected, setConnected] = useState(false);
  const retriesRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!requestId) return;

    const url = `${API_BASE}/api/requests/${requestId}/stream`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    es.onmessage = (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, data]);
        setLatestEvent(data);

        // Stop reconnecting on terminal events
        if (data.type === "resolved" || data.type === "error") {
          es.close();
        }
      } catch {
        // ignore malformed events
      }
    };

    es.onerror = () => {
      es.close();
      setConnected(false);

      if (retriesRef.current < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, retriesRef.current);
        retriesRef.current += 1;
        setTimeout(connect, delay);
      }
    };
  }, [requestId]);

  useEffect(() => {
    if (!requestId) return;

    // Reset state for new request
    setEvents([]);
    setLatestEvent(null);
    retriesRef.current = 0;

    connect();

    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [requestId, connect]);

  return { events, latestEvent, connected };
}
