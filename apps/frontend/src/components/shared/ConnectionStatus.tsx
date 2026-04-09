"use client";

import { cn } from "@/lib/utils";

type ConnectionState = "connected" | "reconnecting" | "disconnected";

interface ConnectionStatusProps {
  status: ConnectionState;
  retryIn?: number;
}

const statusConfig: Record<
  ConnectionState,
  { label: string; dotClass: string; textClass: string }
> = {
  connected: {
    label: "Live",
    dotClass: "bg-[var(--accent-green)]",
    textClass: "text-[var(--accent-green)]",
  },
  reconnecting: {
    label: "Reconnecting",
    dotClass: "bg-[var(--accent-amber)] animate-pulse",
    textClass: "text-[var(--accent-amber)]",
  },
  disconnected: {
    label: "Offline",
    dotClass: "bg-[var(--accent-red)]",
    textClass: "text-[var(--accent-red)]",
  },
};

export function ConnectionStatus({ status, retryIn }: ConnectionStatusProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs shadow-lg">
      <span className={cn("h-2 w-2 rounded-full", config.dotClass)} />
      <span className={cn("font-medium", config.textClass)}>
        {config.label}
      </span>
      {status === "disconnected" && retryIn !== undefined && (
        <span className="text-[var(--text-muted)]">
          retry in {retryIn}s
        </span>
      )}
    </div>
  );
}
