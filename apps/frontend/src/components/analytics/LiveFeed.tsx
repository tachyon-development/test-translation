"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest } from "@/lib/api";

interface FeedEvent {
  id: string;
  timestamp: string;
  type: "created" | "assigned" | "escalated" | "resolved" | "ai_classified";
  description: string;
}

const EVENT_COLORS: Record<string, string> = {
  created: "#6b8cae",
  assigned: "#c9a84c",
  escalated: "#c17767",
  resolved: "#7c9885",
  ai_classified: "#8a7fb5",
};

const EVENT_LABELS: Record<string, string> = {
  created: "New",
  assigned: "Assigned",
  escalated: "Escalated",
  resolved: "Resolved",
  ai_classified: "AI",
};

function generateMockEvents(): FeedEvent[] {
  const types: FeedEvent["type"][] = [
    "created",
    "assigned",
    "escalated",
    "resolved",
    "ai_classified",
  ];
  const rooms = ["201", "305", "412", "118", "503", "720", "215", "601"];
  const depts = ["Maintenance", "Housekeeping", "Concierge", "Front Desk", "Kitchen"];
  const actions = [
    "Extra towels requested",
    "AC not working",
    "Room service order",
    "Late checkout request",
    "Minibar restock",
    "Noise complaint",
    "Spa reservation",
    "Airport shuttle",
    "Plumbing issue",
    "WiFi trouble",
  ];

  const events: FeedEvent[] = [];
  const now = Date.now();
  for (let i = 0; i < 20; i++) {
    const type = types[Math.floor(Math.random() * types.length)];
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const dept = depts[Math.floor(Math.random() * depts.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];

    let desc = "";
    switch (type) {
      case "created":
        desc = `Room ${room}: ${action}`;
        break;
      case "assigned":
        desc = `Room ${room} assigned to ${dept}`;
        break;
      case "escalated":
        desc = `Room ${room} escalated — SLA at risk`;
        break;
      case "resolved":
        desc = `Room ${room}: ${action} resolved`;
        break;
      case "ai_classified":
        desc = `AI routed Room ${room} to ${dept} (0.${85 + Math.floor(Math.random() * 14)})`;
        break;
    }

    events.push({
      id: `evt-${now}-${i}`,
      timestamp: new Date(now - i * 45_000).toISOString(),
      type,
      description: desc,
    });
  }
  return events;
}

export function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await apiRequest<{ events: FeedEvent[] }>(
        "/api/analytics/overview"
      );
      if (res.events?.length) {
        setEvents(res.events.slice(0, 20));
        return;
      }
    } catch {
      // API unavailable
    }
    // Only generate mock on first load
    setEvents((prev) => (prev.length ? prev : generateMockEvents()));
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  // Simulate new events arriving for demo
  useEffect(() => {
    const interval = setInterval(() => {
      const mock = generateMockEvents();
      const newEvent = { ...mock[0], id: `evt-${Date.now()}`, timestamp: new Date().toISOString() };
      setEvents((prev) => [newEvent, ...prev.slice(0, 19)]);
    }, 8_000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to top on new events
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [events[0]?.id]);

  return (
    <div className="relative rounded-xl border border-white/[0.06] bg-[var(--bg-elevated)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Live Event Feed
        </h3>
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#7c9885] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#7c9885]" />
          </span>
          Live
        </span>
      </div>

      <div
        ref={scrollRef}
        className="h-56 space-y-0.5 overflow-y-auto pr-1"
        style={{ scrollbarWidth: "thin" }}
      >
        <AnimatePresence initial={false}>
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: -12, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-white/[0.02]"
            >
              <span
                className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: EVENT_COLORS[event.type] }}
                title={EVENT_LABELS[event.type]}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[var(--text-primary)]">
                  {event.description}
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--text-muted)]">
                  {new Date(event.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </p>
              </div>
              <span
                className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider"
                style={{
                  color: EVENT_COLORS[event.type],
                  backgroundColor: `${EVENT_COLORS[event.type]}15`,
                }}
              >
                {EVENT_LABELS[event.type]}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
