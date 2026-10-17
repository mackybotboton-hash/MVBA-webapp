import { LoadingLogo } from "@/components/shared/loading-logo";

export default function ChatLoading() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      <LoadingLogo size="large" />
      <p className="mt-6 text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-400 animate-pulse">
        Loading conversations...
      </p>
    </div>
  );
}
