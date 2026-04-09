"use client";

import { useEffect, useRef, useState } from "react";

interface SLACountdownProps {
  deadline: Date;
  size?: "sm" | "lg";
}

function getTimeRemaining(deadline: Date): number {
  return deadline.getTime() - Date.now();
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "OVERDUE";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function getProgressColor(ratio: number): string {
  if (ratio > 0.5) return "var(--status-success)"; // sage green
  if (ratio > 0.2) return "var(--status-warning)"; // warm yellow
  return "var(--status-danger)"; // coral
}

export function SLACountdown({ deadline, size = "sm" }: SLACountdownProps) {
  const [remaining, setRemaining] = useState(() => getTimeRemaining(deadline));
  const frameRef = useRef<number>(0);
  // Estimate total SLA duration as 2x whatever has elapsed + remaining
  // But for a proper ratio, assume SLA was set with a known window.
  // We'll approximate: ratio of remaining vs original total window (deadline - createdAt).
  // Since we don't have createdAt, use a heuristic: if remaining > 2h assume 4h window, etc.
  // Better approach: derive from deadline relative to "now at mount time"
  const initialRemainingRef = useRef(Math.max(getTimeRemaining(deadline), 1));

  useEffect(() => {
    initialRemainingRef.current = Math.max(getTimeRemaining(deadline), 1);
  }, [deadline]);

  useEffect(() => {
    let running = true;

    const tick = () => {
      if (!running) return;
      setRemaining(getTimeRemaining(deadline));
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [deadline]);

  const ratio = Math.max(0, Math.min(1, remaining / initialRemainingRef.current));
  const isOverdue = remaining <= 0;
  const color = getProgressColor(ratio);

  const dimensions = size === "lg" ? { s: 80, stroke: 5 } : { s: 40, stroke: 3 };
  const { s, stroke } = dimensions;
  const radius = (s - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - ratio);

  const textSize = size === "lg" ? "text-sm" : "text-[10px]";
  const overdueTextSize = size === "lg" ? "text-xs" : "text-[8px]";

  return (
    <div
      className={`relative inline-flex items-center justify-center ${isOverdue ? "animate-pulse" : ""}`}
      style={{ width: s, height: s }}
    >
      <svg
        width={s}
        height={s}
        viewBox={`0 0 ${s} ${s}`}
        className="-rotate-90"
      >
        {/* Background track */}
        <circle
          cx={s / 2}
          cy={s / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={s / 2}
          cy={s / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke 0.5s ease" }}
        />
      </svg>
      {/* Center text */}
      <span
        className={`absolute font-[family-name:var(--font-mono)] font-medium ${isOverdue ? overdueTextSize : textSize}`}
        style={{ color }}
      >
        {formatRemaining(remaining)}
      </span>
    </div>
  );
}
