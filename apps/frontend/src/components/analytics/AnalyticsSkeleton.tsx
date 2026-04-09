"use client";

import { motion } from "framer-motion";

function ShimmerBlock({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className={`shimmer rounded-md ${className ?? ""}`}
    />
  );
}

function KPICardSkeleton({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-6 space-y-3"
    >
      {/* Label */}
      <ShimmerBlock className="h-3 w-20" />
      {/* Number */}
      <ShimmerBlock className="h-8 w-24" />
      {/* Delta */}
      <div className="flex items-center gap-2">
        <ShimmerBlock className="h-3 w-10" />
        <ShimmerBlock className="h-3 w-16" />
      </div>
    </motion.div>
  );
}

function ChartSkeleton({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-6 space-y-4"
    >
      {/* Chart title */}
      <div className="flex items-center justify-between">
        <ShimmerBlock className="h-4 w-32" />
        <ShimmerBlock className="h-7 w-24 rounded-lg" />
      </div>
      {/* Chart area */}
      <ShimmerBlock className="h-52 w-full rounded-lg" />
    </motion.div>
  );
}

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} delay={i * 0.05} />
        ))}
      </div>

      {/* 2x2 chart grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ChartSkeleton key={i} delay={0.2 + i * 0.05} />
        ))}
      </div>
    </div>
  );
}
