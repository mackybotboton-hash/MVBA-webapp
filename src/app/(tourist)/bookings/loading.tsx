import { LoadingLogo } from "@/components/shared/loading-logo";

export default function BookingsLoading() {
  return (
    <div className="min-h-screen bg-neutral-50/50 flex flex-col items-center justify-center p-4">
      <LoadingLogo size="large" />
      <p className="mt-6 text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-400 animate-pulse">
        Loading your reservations &amp; passes...
      </p>
      <p className="mt-1.5 text-[11px] text-neutral-400 font-medium">
        Panaw Bretania Pass
      </p>
    </div>
  );
}
