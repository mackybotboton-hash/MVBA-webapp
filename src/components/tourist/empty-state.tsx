import * as React from "react";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/50 p-8 transition-colors",
        compact ? "py-8 px-4" : "py-16 px-6",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-sm text-neutral-800 mb-4">
        <Icon className="h-6 w-6 stroke-[1.75]" aria-hidden="true" />
      </div>

      <h3 className="text-base font-semibold text-neutral-900 tracking-tight">
        {title}
      </h3>

      <p className="mt-1.5 text-sm text-neutral-600 max-w-sm leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {actionLabel && (
            <Button
              onClick={onAction}
              className="bg-black text-white hover:bg-neutral-800 text-xs h-9 px-4 font-medium"
            >
              {actionLabel}
            </Button>
          )}

          {secondaryActionLabel && (
            <Button
              variant="outline"
              onClick={onSecondaryAction}
              className="border-neutral-200 text-neutral-700 hover:bg-neutral-100 text-xs h-9 px-4"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
