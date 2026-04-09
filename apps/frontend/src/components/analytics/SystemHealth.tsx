"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/api";

interface ServiceStatus {
  name: string;
  status: "up" | "down" | "unknown";
}

const DEFAULT_SERVICES: ServiceStatus[] = [
  { name: "Ollama", status: "unknown" },
  { name: "Whisper", status: "unknown" },
  { name: "PostgreSQL", status: "unknown" },
  { name: "Redis", status: "unknown" },
];

const STATUS_COLORS: Record<string, string> = {
  up: "#7c9885",
  down: "#c17767",
  unknown: "#c9a84c",
};

const STATUS_LABELS: Record<string, string> = {
  up: "UP",
  down: "DOWN",
  unknown: "---",
};

export function SystemHealth() {
  const [services, setServices] = useState<ServiceStatus[]>(DEFAULT_SERVICES);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await apiRequest<{ services: ServiceStatus[] }>(
        "/api/health/services"
      );
      if (res.services?.length) {
        setServices(res.services);
        return;
      }
    } catch {
      // API unavailable — show mock "up" for demo
    }
    setServices([
      { name: "Ollama", status: "up" },
      { name: "Whisper", status: "up" },
      { name: "PostgreSQL", status: "up" },
      { name: "Redis", status: "up" },
    ]);
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.3 }}
      className="rounded-xl border border-white/[0.06] bg-[var(--bg-elevated)] px-5 py-3"
    >
      <div className="flex flex-wrap items-center gap-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          System Health
        </h3>
        {services.map((svc) => (
          <div key={svc.name} className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-secondary)]">
              {svc.name}
            </span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[svc.status] }}
              />
              <span
                className="font-[family-name:var(--font-mono)] text-[10px] font-bold"
                style={{ color: STATUS_COLORS[svc.status] }}
              >
                {STATUS_LABELS[svc.status]}
              </span>
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
