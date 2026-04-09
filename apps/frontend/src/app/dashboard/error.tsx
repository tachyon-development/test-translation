"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Wifi } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-primary)]">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 text-center">
        {/* Icon */}
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent,#d4a574)]/10">
          <AlertTriangle className="h-8 w-8 text-[var(--accent,#d4a574)]" />
        </div>

        {/* Title */}
        <h1 className="font-display mb-2 text-2xl font-semibold text-[var(--text-primary)]">
          Dashboard encountered an error
        </h1>

        {/* Description */}
        <p className="mb-4 text-sm text-[var(--text-secondary)]">
          Something went wrong while loading the dashboard. This may be a
          temporary issue.
        </p>

        {/* Connection hint */}
        <div className="mb-8 flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2.5 text-xs text-[var(--text-muted)]">
          <Wifi className="h-3.5 w-3.5" />
          Please check your network connection and try again.
        </div>

        {/* Retry button */}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#d4a574] to-[#c4956a] px-6 py-3 text-sm font-medium text-[#1a1a2e] shadow-[0_0_40px_-8px_rgba(212,165,116,0.35)] transition-all hover:shadow-[0_0_60px_-8px_rgba(212,165,116,0.5)]"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
