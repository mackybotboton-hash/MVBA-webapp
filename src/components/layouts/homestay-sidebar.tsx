"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { HOMESTAY_NAV_ITEMS } from "@/lib/constants";

import { ChevronLeft } from "lucide-react";
import { useState } from "react";

export function HomestaySidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-screen sticky top-0 border-r border-gray-200 bg-white transition-all duration-300",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-gray-200">
        <Logo size="small" href="/homestay" iconOnly={collapsed} />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "p-1.5 rounded-lg hover:bg-gray-100 transition-all text-gray-400 hover:text-gray-600",
            collapsed ? "mx-auto" : "ml-auto"
          )}
          aria-label="Toggle sidebar"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-2 space-y-0.5">
        {!collapsed && (
          <p className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
            Management
          </p>
        )}
        {HOMESTAY_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/homestay" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <div key={item.href} className="relative group/tooltip">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group",
                  isActive
                    ? "bg-gray-100 text-black font-semibold"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50",
                  collapsed && "justify-center px-0"
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
                {!collapsed && <span>{item.label}</span>}
              </Link>
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 px-2 py-1.5 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-md">
                  {item.label}
                  <div className="absolute left-0 top-1/2 -translate-x-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200">
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2",
            collapsed && "justify-center"
          )}
        >
          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          {!collapsed && (
            <span className="text-xs text-gray-400">Homestay Portal</span>
          )}
        </div>
      </div>
    </aside>
  );
}
