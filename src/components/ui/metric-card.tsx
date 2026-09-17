"use client";

import * as React from "react";
import Link from "next/link";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  /** Label describing the metric (e.g., "Active Bookings", "Monthly Dues") */
  label: string;

  /** Primary value to display (e.g., "₱14,500", "28") */
  value: React.ReactNode;

  /** Optional secondary subtitle or comparison (e.g., "vs last month") */
  subtext?: string;

  /** Icon displayed in the top right header */
  icon?: LucideIcon;

  /** Trend direction and percentage */
  trend?: {
    value: number | string;
    direction: "up" | "down" | "neutral";
    label?: string;
  };

  /** Loading state flag */
  isLoading?: boolean;

  /** Optional target href to turn the card into an interactive navigation link */
  href?: string;

  /** Optional badge in the top right */
  badge?: React.ReactNode;

  /** Optional custom class name */
  className?: string;

  /** Accent theme variant */
  variant?: "default" | "dark" | "emerald" | "amber";
}

/**
 * Production-grade MetricCard component.
 * Provides accessible, responsive statistics cards with skeleton loading, trends, and click targets.
 */
export function MetricCard({
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  isLoading = false,
  href,
  badge,
  className,
  variant = "default",
}: MetricCardProps) {
  const variantStyles = {
    default: "bg-white border-neutral-200/90 text-neutral-900 shadow-xs hover:border-neutral-300",
    dark: "bg-neutral-950 border-neutral-800 text-white shadow-md hover:border-neutral-700",
    emerald: "bg-emerald-950/20 border-emerald-500/20 text-emerald-950 shadow-xs hover:border-emerald-500/30",
    amber: "bg-amber-950/20 border-amber-500/20 text-amber-950 shadow-xs hover:border-amber-500/30",
  };

  const content = (
    <div
      className={cn(
        "relative rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200",
        variantStyles[variant],
        href && "group cursor-pointer hover:shadow-md hover:-translate-y-0.5",
        className
      )}
    >
      {/* Card Header: Label & Icon */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <span
          className={cn(
            "text-xs font-bold uppercase tracking-wider",
            variant === "dark" ? "text-neutral-500" : "text-neutral-600"
          )}
        >
          {label}
        </span>

        <div className="flex items-center gap-1.5">
          {badge}
          {Icon && (
            <div
              className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center transition-colors",
                variant === "dark"
                  ? "bg-neutral-800 text-neutral-300 group-hover:bg-neutral-700"
                  : "bg-neutral-100/80 text-neutral-600 group-hover:bg-neutral-100 group-hover:text-black"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>

      {/* Primary Value */}
      <div className="space-y-1">
        {isLoading ? (
          <Skeleton className="h-8 w-28 rounded-lg" />
        ) : (
          <div className="text-2xl sm:text-3xl font-black tracking-tight">
            {value}
          </div>
        )}

        {/* Subtext or Trend indicator */}
        <div className="flex items-center gap-2 pt-0.5 text-xs">
          {isLoading ? (
            <Skeleton className="h-4 w-20 rounded-md" />
          ) : trend ? (
            <div
              className={cn(
                "inline-flex items-center gap-0.5 font-bold text-[11px] px-1.5 py-0.5 rounded-md",
                trend.direction === "up" && "bg-emerald-100 text-emerald-700",
                trend.direction === "down" && "bg-red-100 text-red-700",
                trend.direction === "neutral" && "bg-neutral-100 text-neutral-600"
              )}
            >
              {trend.direction === "up" && <ArrowUpRight className="h-3 w-3" />}
              {trend.direction === "down" && <ArrowDownRight className="h-3 w-3" />}
              {trend.direction === "neutral" && <Minus className="h-3 w-3" />}
              <span>{trend.value}</span>
            </div>
          ) : null}

          {subtext && !isLoading && (
            <span
              className={cn(
                "text-xs truncate",
                variant === "dark" ? "text-neutral-500" : "text-neutral-600"
              )}
            >
              {subtext}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block outline-none focus-visible:ring-2 focus-visible:ring-black rounded-2xl">
        {content}
      </Link>
    );
  }

  return content;
}
