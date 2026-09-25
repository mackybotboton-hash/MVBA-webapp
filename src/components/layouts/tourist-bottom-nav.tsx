"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { TOURIST_NAV_ITEMS } from "@/lib/constants";
import { useNotificationCounts } from "@/hooks/use-notification-counts";
import { useAuth } from "@/hooks/use-auth";

/** Renders a red badge dot or count bubble above an icon */
function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-0.5 -right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function TouristBottomNav() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  // Live badge counts — sourced from the singleton NotificationCountsProvider.
  // The Provider manages its own Realtime subscription via useAuth() internally.
  const { unreadMessages } = useNotificationCounts();

  // Don't render until auth is resolved, and hide for non-logged-in visitors
  if (isLoading || !user) return null;

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

            // Determine badge count for this nav item
            const badgeCount =
              item.href === "/chat" ? unreadMessages : 0;

            const isHostView = user?.role === "homestay_owner" || user?.role === "resort_owner";

            const innerContent = (
              <>
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-all duration-300 ${
                      isActive ? "scale-110 drop-shadow-md" : "opacity-80"
                    }`}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <NavBadge count={badgeCount} />
                </div>
                <span
                  className={`text-xs font-medium transition-colors duration-300 ${
                    isActive ? "opacity-100" : "opacity-80"
                  }`}
                >
                  {item.label}
                </span>
              </>
            );

            const className = cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all min-w-[56px]",
              isActive
                ? "text-black"
                : "text-gray-400 active:text-gray-600",
              isHostView && "opacity-50 cursor-not-allowed pointer-events-none"
            );

            if (isHostView) {
              return (
                <div key={item.href} className={className}>
                  {innerContent}
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={className}
              >
                {innerContent}
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