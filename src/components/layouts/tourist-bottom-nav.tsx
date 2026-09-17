"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TOURIST_NAV_ITEMS } from "@/lib/constants";

export function TouristBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      {/* Clean white background */}
      <div className="border-t border-gray-200 bg-white">
        <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
          {TOURIST_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all min-w-[56px]",
                  isActive
                    ? "text-black"
                    : "text-gray-400 active:text-gray-600"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5 transition-all" />
                  {isActive && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-black" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium transition-all",
                    isActive ? "text-black font-semibold" : "text-gray-400"
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Safe area spacer for iOS */}
      <div className="h-[env(safe-area-inset-bottom)] bg-white" />
    </nav>
  );
}
