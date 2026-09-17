"use client";

import * as React from "react";
import { Loader2, AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StateViewProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The current state of the async view:
   * - 'loading': displays an accessible loading spinner/skeleton
   * - 'error': displays an error alert with an optional retry button
   * - 'empty': displays an empty state with title, description, and call-to-action
   * - 'content': renders the children
   */
  state: "loading" | "error" | "empty" | "content";

  /** Custom loading message or component */
  loadingText?: string;
  loadingComponent?: React.ReactNode;

  /** Error state props */
  errorTitle?: string;
  errorMessage?: string;
  onRetry?: () => void;
  retryText?: string;

  /** Empty state props */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyIcon?: React.ReactNode;
  emptyAction?: React.ReactNode;

  /** Children to render when state is 'content' */
  children?: React.ReactNode;
}

/**
 * Production-grade StateView component.
 * Standardizes Loading, Error, Empty, and Content states with full ARIA live region support.
 */
export function StateView({
  state,
  loadingText = "Loading details...",
  loadingComponent,
  errorTitle = "Something went wrong",
  errorMessage = "We were unable to load the requested information. Please try again.",
  onRetry,
  retryText = "Try Again",
  emptyTitle = "No records found",
  emptyDescription = "There are currently no items to display.",
  emptyIcon,
  emptyAction,
  children,
  className,
  ...props
}: StateViewProps) {
  if (state === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-neutral-100 bg-white/50 backdrop-blur-xs min-h-[220px]",
          className
        )}
        {...props}
      >
        {loadingComponent || (
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-800 animate-pulse">
              <Loader2 className="h-5 w-5 animate-spin text-neutral-900" />
            </div>
            <p className="text-xs font-semibold text-neutral-600 tracking-wide">
              {loadingText}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (state === "error") {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          "flex flex-col items-center justify-center py-12 px-6 text-center rounded-2xl border border-red-100 bg-red-50/40 min-h-[220px]",
          className
        )}
        {...props}
      >
        <div className="h-12 w-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3 shadow-xs">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-bold text-neutral-900">{errorTitle}</h3>
        <p className="text-xs text-neutral-600 max-w-sm mt-1 mb-4 leading-relaxed">
          {errorMessage}
        </p>
        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="rounded-xl bg-black text-white hover:bg-neutral-800 text-xs font-bold gap-1.5 shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{retryText}</span>
          </Button>
        )}
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div
        role="region"
        aria-label={emptyTitle}
        className={cn(
          "flex flex-col items-center justify-center py-16 px-6 text-center rounded-2xl border border-neutral-200/80 bg-white shadow-xs min-h-[240px]",
          className
        )}
        {...props}
      >
        <div className="h-14 w-14 rounded-2xl bg-neutral-100 text-neutral-500 flex items-center justify-center mb-3.5 shadow-xs">
          {emptyIcon || <Inbox className="h-6 w-6 text-neutral-600" />}
        </div>
        <h3 className="text-base font-bold text-neutral-900">{emptyTitle}</h3>
        <p className="text-xs text-neutral-600 max-w-sm mt-1.5 mb-5 leading-relaxed">
          {emptyDescription}
        </p>
        {emptyAction && <div className="mt-1">{emptyAction}</div>}
      </div>
    );
  }

  return <>{children}</>;
}
