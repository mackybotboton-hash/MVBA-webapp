import { LoadingLogo } from "@/components/shared/loading-logo";

export default function PropertyDetailsLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <LoadingLogo size="large" />
      <p className="mt-6 text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-400 animate-pulse">
        Loading stay details...
      </p>
      <p className="mt-1.5 text-[11px] text-neutral-400 font-medium">
        Bretania 24 Islands, San Agustin
      </p>
    </div>
  );
}
