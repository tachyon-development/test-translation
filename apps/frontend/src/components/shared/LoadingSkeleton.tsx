import { cn } from "@/lib/utils";

function ShimmerBlock({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md", className)} />;
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 space-y-4",
        className
      )}
    >
      <ShimmerBlock className="h-5 w-2/5" />
      <ShimmerBlock className="h-3 w-full" />
      <ShimmerBlock className="h-3 w-4/5" />
      <ShimmerBlock className="h-3 w-3/5" />
    </div>
  );
}

export function SkeletonKanban() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, col) => (
        <div key={col} className="space-y-3">
          <ShimmerBlock className="h-8 w-24" />
          {Array.from({ length: 3 }).map((_, row) => (
            <SkeletonCard key={row} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKPI() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 space-y-3"
        >
          <ShimmerBlock className="h-3 w-20" />
          <ShimmerBlock className="h-8 w-24" />
          <ShimmerBlock className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
