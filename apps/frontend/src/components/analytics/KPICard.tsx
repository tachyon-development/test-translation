"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface KPICardProps {
  label: string;
  value: number;
  format?: "number" | "percent" | "duration";
  delta?: number;
  deltaLabel?: string;
  delay?: number;
}

function formatValue(value: number, format: KPICardProps["format"]): string {
  switch (format) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "duration":
      return `${value.toFixed(1)}min`;
    default:
      return Math.round(value).toString();
  }
}

export function KPICard({
  label,
  value,
  format = "number",
  delta,
  deltaLabel,
  delay = 0,
}: KPICardProps) {
  const [showDelta, setShowDelta] = useState(false);
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, { stiffness: 50, damping: 20 });
  const display = useTransform(spring, (v) => formatValue(v, format));
  const [displayText, setDisplayText] = useState(formatValue(0, format));

  useEffect(() => {
    const timeout = setTimeout(() => {
      motionVal.set(value);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [value, delay, motionVal]);

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => setDisplayText(v));
    return unsubscribe;
  }, [display]);

  useEffect(() => {
    const timer = setTimeout(() => setShowDelta(true), (delay + 1) * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  const isPositive = delta !== undefined && delta >= 0;
  const deltaColor = isPositive ? "#7c9885" : "#c17767";
  const arrow = isPositive ? "\u25B2" : "\u25BC";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay, duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-xl border border-white/[0.06] p-6"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {/* Glass highlight */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, transparent 40%)",
        }}
      />

      <p className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        {label}
      </p>

      <p className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-bold text-[var(--text-primary)]">
        {displayText}
      </p>

      {delta !== undefined && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showDelta ? 1 : 0 }}
          transition={{ duration: 0.4 }}
          className="mt-2 flex items-center gap-1.5"
        >
          <span className="text-xs font-semibold" style={{ color: deltaColor }}>
            {arrow} {Math.abs(delta).toFixed(1)}
            {format === "percent" ? "%" : format === "duration" ? "m" : ""}
          </span>
          {deltaLabel && (
            <span className="text-[10px] text-[var(--text-muted)]">
              {deltaLabel}
            </span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
