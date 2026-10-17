import { LoadingLogo } from "@/components/shared/loading-logo";

export default function ExploreLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <LoadingLogo size="large" />
      <p className="mt-6 text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-400 animate-pulse">
        Exploring Bretania 24 Islands...
      </p>
      <p className="mt-1.5 text-[11px] text-neutral-400 font-medium">
        San Agustin, Surigao del Sur
      </p>
    </div>
  );
}
