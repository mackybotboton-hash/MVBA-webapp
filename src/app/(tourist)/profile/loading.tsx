import { LoadingLogo } from "@/components/shared/loading-logo";

export default function ProfileLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center py-10">
      <LoadingLogo size="large" />
      <p className="mt-3 text-xs sm:text-sm font-semibold tracking-wider uppercase text-neutral-400 animate-pulse">
        Loading your profile
      </p>
    </div>
  );
}
