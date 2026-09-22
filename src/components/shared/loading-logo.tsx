import Image from "next/image";

export function LoadingLogo({ 
  size = "default", 
  className = "" 
}: { 
  size?: "small" | "default" | "large";
  className?: string;
}) {
  const sizeMap = {
    small: 16,
    default: 32,
    large: 64,
  };

  const dim = sizeMap[size];

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <div className="absolute inset-0 bg-neutral-200/50 rounded-xl animate-ping opacity-75" style={{ animationDuration: '2s' }} />
      <div className="relative bg-white rounded-lg p-1 shadow-sm animate-pulse">
        <Image
          src="/icons/icon-192.png"
          alt="Loading..."
          width={dim}
          height={dim}
          className="rounded-md"
        />
      </div>
    </div>
  );
}
