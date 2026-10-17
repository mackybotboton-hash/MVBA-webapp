import { LoadingLogo } from "@/components/shared/loading-logo";

export default function ResortBookingsLoading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
      <LoadingLogo size="large" />
      <p className="mt-6 text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-400 animate-pulse">
        Loading resort reservations...
      </p>
    </div>
  );
}
