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
        "flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 transition-colors",
        compact ? "py-5 px-3" : "py-7 sm:py-9 px-4 sm:px-6",
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white border border-neutral-200 shadow-xs text-neutral-800 mb-3">
        <Icon className="h-5 w-5 stroke-[1.75]" aria-hidden="true" />
      </div>

      <h3 className="text-sm sm:text-base font-semibold text-neutral-900 tracking-tight">
        {title}
      </h3>

      <p className="mt-1 text-xs sm:text-sm text-neutral-600 max-w-sm leading-relaxed">
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-2">
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
