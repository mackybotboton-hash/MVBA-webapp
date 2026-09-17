"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/logo";
import { ADMIN_NAV_ITEMS } from "@/lib/constants";
import { ChevronLeft } from "lucide-react";
import { useState } from "react";

export function AdminSidebar() {
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
        {!collapsed && <Logo size="small" href="/admin" />}
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
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          const Icon = item.icon;

          const content = (
            <>
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  isActive && !item.disabled
                    ? "text-black"
                    : "text-gray-400 group-hover:text-gray-600"
                )}
              />
              {!collapsed && <span>{item.label}</span>}
            </>
          );

          if (item.disabled) {
            return (
              <div
                key={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group opacity-50 cursor-not-allowed pointer-events-none text-gray-500"
                )}
              >
                {content}
              </div>
            );
          }

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
              {content}
            </Link>
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
            <span className="text-xs text-gray-400">Admin Portal</span>
          )}
        </div>
      </div>
    </aside>
  );
}
