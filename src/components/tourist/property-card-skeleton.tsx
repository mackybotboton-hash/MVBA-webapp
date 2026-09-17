import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export interface PropertyCardSkeletonProps {
  viewMode?: "grid" | "feed";
  className?: string;
}

export function PropertyCardSkeleton({
  viewMode = "grid",
  className,
}: PropertyCardSkeletonProps) {
  if (viewMode === "feed") {
    return (
      <div
        className={cn(
          "w-full rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-xs",
          className
        )}
      >
        <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full bg-neutral-100">
          <Skeleton className="h-full w-full rounded-none" />
          <div className="absolute top-3 left-3 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-md" />
            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
          <div className="absolute top-3 right-3">
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-5 w-3/4 rounded-sm" />
              <Skeleton className="h-4 w-1/2 rounded-sm" />
            </div>
            <Skeleton className="h-5 w-12 rounded-sm" />
          </div>
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-6 w-24 rounded-sm" />
              <Skeleton className="h-3 w-16 rounded-sm" />
            </div>
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Grid layout skeleton
  return (
    <div
      className={cn(
        "group flex flex-col rounded-xl border border-neutral-200 bg-white overflow-hidden shadow-xs",
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full bg-neutral-100">
        <Skeleton className="h-full w-full rounded-none" />
        <div className="absolute top-2.5 left-2.5">
          <Skeleton className="h-5 w-16 rounded-md" />
        </div>
        <div className="absolute top-2.5 right-2.5">
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
      <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-2/3 rounded-sm" />
            <Skeleton className="h-4 w-8 rounded-sm" />
          </div>
          <Skeleton className="h-3.5 w-1/2 rounded-sm" />
        </div>
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <Skeleton className="h-5 w-20 rounded-sm" />
          <Skeleton className="h-3 w-14 rounded-sm" />
        </div>
      </div>
    </div>
  );
}

export function PropertyListSkeleton({
  count = 6,
  viewMode = "grid",
}: {
  count?: number;
  viewMode?: "grid" | "feed";
}) {
  return (
    <div
      className={cn(
        viewMode === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          : "flex flex-col gap-6 max-w-2xl mx-auto"
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <PropertyCardSkeleton key={index} viewMode={viewMode} />
      ))}
    </div>
  );
}
