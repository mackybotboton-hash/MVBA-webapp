"use client";

import * as React from "react";
import Image from "next/image";
import { getInitials, cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image source URL */
  src?: string | null;

  /** Name of the user (used for generating initials and alt text) */
  name?: string | null;

  /** Display size */
  size?: "xs" | "sm" | "md" | "lg" | "xl";

  /** Optional online/offline status dot indicator */
  status?: "online" | "offline" | "busy" | null;

  /** Color scheme for the fallback background */
  variant?: "dark" | "neutral" | "emerald" | "amber";
}

/**
 * Production-grade Avatar component with image fallback and initials generation.
 */
export function Avatar({
  src,
  name = "User",
  size = "md",
  status = null,
  variant = "dark",
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);

  const sizeStyles = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
  };

  const statusSizeStyles = {
    xs: "h-1.5 w-1.5 ring-1",
    sm: "h-2 w-2 ring-1.5",
    md: "h-2.5 w-2.5 ring-2",
    lg: "h-3.5 w-3.5 ring-2",
    xl: "h-4 w-4 ring-2",
  };

  const variantStyles = {
    dark: "bg-neutral-900 text-white",
    neutral: "bg-neutral-200 text-neutral-800",
    emerald: "bg-emerald-700 text-white",
    amber: "bg-amber-700 text-white",
  };

  const statusColors = {
    online: "bg-emerald-500",
    offline: "bg-neutral-400",
    busy: "bg-red-500",
  };

  const initials = getInitials(name || "User");
  const hasValidImage = src && !imageError;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full font-bold select-none overflow-visible",
        sizeStyles[size],
        className
      )}
      {...props}
    >
      <div
        className={cn(
          "relative h-full w-full rounded-full overflow-hidden flex items-center justify-center shadow-xs",
          variantStyles[variant]
        )}
      >
        {hasValidImage ? (
          <img
            src={src}
            alt={name || "Avatar"}
            onError={() => setImageError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Online Status Indicator */}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full ring-white",
            statusSizeStyles[size],
            statusColors[status]
          )}
          aria-label={`Status: ${status}`}
        />
      )}
    </div>
  );
}

/**
 * AvatarGroup component for displaying overlapping user or member avatars.
 */
export function AvatarGroup({
  children,
  limit = 4,
  totalCount,
  className,
}: {
  children: React.ReactNode;
  limit?: number;
  totalCount?: number;
  className?: string;
}) {
  const childrenArray = React.Children.toArray(children);
  const visibleAvatars = childrenArray.slice(0, limit);
  const remainingCount = totalCount !== undefined ? totalCount - limit : childrenArray.length - limit;

  return (
    <div className={cn("flex items-center -space-x-2.5 overflow-hidden", className)}>
      {visibleAvatars.map((child, index) => (
        <div key={index} className="ring-2 ring-white rounded-full">
          {child}
        </div>
      ))}

      {remainingCount > 0 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 text-[11px] font-black ring-2 ring-white shadow-xs">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
