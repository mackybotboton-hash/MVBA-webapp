import Link from "next/link";
import Image from "next/image";

export function Logo({
  size = "default",
  href = "/",
  iconOnly = false,
}: {
  size?: "small" | "default" | "large";
  href?: string;
  iconOnly?: boolean;
}) {
  const sizeClasses = {
    small: "text-lg",
    default: "text-2xl",
    large: "text-4xl",
  };

  return (
    <Link href={href} className="flex items-center gap-2 group">
      <div className="relative">
        <Image
          src="/icons/icon-192.png"
          alt="Britania Logo"
          width={32}
          height={32}
          className="rounded-lg shadow-sm"
        />
      </div>
      {!iconOnly && (
        <div className="flex flex-col">
          <span
            className={`font-bold tracking-tight text-black ${sizeClasses[size]}`}
          >
            Britania
          </span>
          {size !== "small" && (
            <span className="text-[10px] text-gray-400 leading-none -mt-0.5 tracking-widest uppercase">
              Surigao del Sur
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
