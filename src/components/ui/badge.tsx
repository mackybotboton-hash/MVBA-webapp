import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 select-none",
  {
    variants: {
      variant: {
        default: "border border-transparent bg-black text-white hover:bg-neutral-800",
        secondary: "border border-transparent bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
        outline: "border border-neutral-200 text-neutral-800 bg-white hover:bg-neutral-50",
        subtle: "border border-neutral-200/80 bg-neutral-50 text-neutral-700",
        success: "border border-emerald-200 bg-emerald-50 text-emerald-800",
        warning: "border border-amber-200 bg-amber-50 text-amber-800",
        destructive: "border border-red-200 bg-red-50 text-red-800",
      },
      size: {
        sm: "text-[10px] px-1.5 py-0.5",
        default: "text-xs px-2 py-0.5",
        lg: "text-xs px-2.5 py-1 font-semibold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: string;
}

function Badge({ className, variant, size, dot, dotColor, children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotColor || "bg-current"
          )}
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
