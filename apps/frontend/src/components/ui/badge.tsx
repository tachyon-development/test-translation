import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--accent-blue)] text-white shadow",
        secondary:
          "border-transparent bg-[var(--bg-secondary)] text-[var(--text-primary)]",
        destructive:
          "border-transparent bg-[var(--accent-red)] text-white shadow",
        outline: "border-[var(--border-color)] text-[var(--text-primary)]",
        success:
          "border-transparent bg-[var(--accent-green)] text-white shadow",
        warning:
          "border-transparent bg-[var(--accent-amber)] text-black shadow",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
