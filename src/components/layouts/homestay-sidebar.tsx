"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { HOMESTAY_NAV_ITEMS } from "@/lib/constants";

export function HomestaySidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen sticky top-0 border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <Logo size="small" href="/homestay" />
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-2 space-y-0.5">
        <p className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
          Management
        </p>
        {HOMESTAY_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/homestay" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-gray-100 text-black font-semibold"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  isActive
                    ? "text-black"
                    : "text-gray-400 group-hover:text-gray-600"
                )}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs text-gray-400">Homestay Portal</span>
        </div>
      </div>
    </aside>
  );
}
