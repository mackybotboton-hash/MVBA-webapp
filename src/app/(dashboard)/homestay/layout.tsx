"use client";

import { HomestaySidebar } from "@/components/layouts/homestay-sidebar";
import { Topbar } from "@/components/layouts/topbar";
import { useState } from "react";
import { Logo } from "@/components/shared/logo";
import { HOMESTAY_NAV_ITEMS } from "@/lib/constants";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useNotificationCounts } from "@/hooks/use-notification-counts";

/** Renders a compact count badge beside a nav label */
function NavBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function HomestayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Live badge counts
  const { unseenBookings, unreadMessages } = useNotificationCounts();
  const badgeMap: Record<string, number> = {
    "/homestay/bookings": unseenBookings,
    "/homestay/chat": unreadMessages,
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <HomestaySidebar />

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 h-full bg-white border-r border-gray-200 flex flex-col animate-in slide-in-from-left duration-300">
            <div className="h-14 flex items-center justify-between px-4 border-b border-gray-200">
              <Logo size="small" href="/homestay" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 p-2 space-y-0.5">
              {HOMESTAY_NAV_ITEMS.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/homestay" && pathname.startsWith(item.href));
                const Icon = item.icon;
                const badge = badgeMap[item.href] ?? 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-gray-100 text-black font-semibold"
                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 flex-shrink-0", isActive ? "text-black" : "text-gray-400")} />
                    <span>{item.label}</span>
                    <NavBadge count={badge} />
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onMenuToggle={() => setMobileMenuOpen(true)}
          title="Homestay Portal"
        />
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
