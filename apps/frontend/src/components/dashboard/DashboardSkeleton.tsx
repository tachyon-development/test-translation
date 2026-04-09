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

function SkeletonCard({ delay }: { delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-elevated)] p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <ShimmerBlock className="h-4 w-16" />
        <ShimmerBlock className="h-4 w-10 rounded-full" />
      </div>
      <ShimmerBlock className="h-3 w-full" />
      <ShimmerBlock className="h-3 w-4/5" />
      <div className="flex items-center gap-2 pt-1">
        <ShimmerBlock className="h-5 w-5 rounded-full" />
        <ShimmerBlock className="h-3 w-20" />
      </div>
    </motion.div>
  );
}

const columnCardCounts = [3, 2, 2, 3];

export function DashboardSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar skeleton */}
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-[var(--bg-primary)]">
        {/* Logo placeholder */}
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-4">
          <ShimmerBlock className="h-8 w-8 rounded-lg" />
          <ShimmerBlock className="h-5 w-20" />
        </div>

        {/* Nav items */}
        <div className="px-3 py-4 space-y-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5 px-3 py-2">
              <ShimmerBlock className="h-4 w-4 rounded" delay={i * 0.05} />
              <ShimmerBlock className="h-3.5 w-20" delay={i * 0.05} />
            </div>
          ))}
        </div>

        {/* Stats section */}
        <div className="mt-4 border-t border-white/5 px-6 pt-4 space-y-3">
          <ShimmerBlock className="h-2.5 w-24" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <ShimmerBlock className="h-3 w-20" delay={0.25 + i * 0.05} />
              <ShimmerBlock className="h-4 w-8" delay={0.25 + i * 0.05} />
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Filter bar skeleton */}
        <header className="flex items-center justify-between border-b border-white/5 px-6 py-3">
          <div className="flex items-center gap-3">
            <ShimmerBlock className="h-9 w-36 rounded-lg" />
            <ShimmerBlock className="h-9 w-28 rounded-lg" />
            <ShimmerBlock className="h-9 w-48 rounded-lg" />
          </div>
          <ShimmerBlock className="h-7 w-20 rounded-full" />
        </header>

        {/* Kanban columns */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {columnCardCounts.map((cardCount, col) => (
              <div key={col} className="flex flex-col gap-2.5">
                {/* Column header */}
                <div className="mb-1 flex items-center gap-2">
                  <ShimmerBlock className="h-5 w-20" delay={col * 0.05} />
                  <ShimmerBlock className="h-5 w-5 rounded-full" delay={col * 0.05} />
                </div>

                {/* Cards with staggered animation */}
                {Array.from({ length: cardCount }).map((_, row) => (
                  <SkeletonCard
                    key={row}
                    delay={col * 0.05 + row * 0.05}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
