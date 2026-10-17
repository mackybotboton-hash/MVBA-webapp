import Image from "next/image";

export function LoadingLogo({ 
  size = "default", 
  className = "",
  label,
}: { 
  size?: "small" | "default" | "large";
  className?: string;
  label?: string;
}) {
  const sizeMap = {
    small: 20,
    default: 36,
    large: 64,
  };

  const dim = sizeMap[size];

  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <div className="relative flex items-center justify-center">
        {/* Ambient breathing ripple */}
        <div
          className="absolute inset-0 bg-neutral-200/60 rounded-2xl animate-ping opacity-60"
          style={{ animationDuration: "2.4s" }}
        />
        {/* Floating container with soft shadow */}
        <div className="relative bg-white rounded-2xl p-2 shadow-md ring-1 ring-black/5 animate-pulse">
          <Image
            src="/icons/icon-192.png"
            alt="Loading..."
            width={dim}
            height={dim}
            priority
            className="rounded-xl object-contain select-none"
          />
        </div>
      </div>
      {label && (
        <p className="mt-4 text-xs sm:text-sm font-bold tracking-wider uppercase text-neutral-400 animate-pulse text-center">
          {label}
        </p>
      )}
    </div>
  );
}
