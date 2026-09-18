"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { LayoutDashboard, Home, Ship, CalendarCheck, Settings, Search, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.FC<{ className?: string }>;
}

const DASHBOARD_CONFIGS: Record<string, NavItem[]> = {
  admin: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/properties", label: "Properties", icon: Home },
    { href: "/admin/dues", label: "Dues", icon: CalendarCheck },
  ],
  homestay: [
    { href: "/homestay", label: "Rooms", icon: Home },
    { href: "/homestay/bookings", label: "Bookings", icon: CalendarCheck },
    { href: "/homestay/chat", label: "Messages", icon: MessageCircle },
  ],
  resort: [
    { href: "/resort", label: "Rooms", icon: Home },
    { href: "/resort/dispatch", label: "Dispatch", icon: Ship },
    { href: "/resort/bookings", label: "Bookings", icon: CalendarCheck },
  ],
  tourist: [
    { href: "/", label: "Explore", icon: Search },
    { href: "/bookings", label: "Trips", icon: CalendarCheck },
    { href: "/chat", label: "Inbox", icon: MessageCircle },
    { href: "/profile", label: "Profile", icon: Settings },
  ]
};

export function RoleDashboardNav({ role }: { role: "admin" | "homestay" | "resort" | "tourist" }) {
  const pathname = usePathname();
  const navItems = DASHBOARD_CONFIGS[role] || DASHBOARD_CONFIGS.tourist;

  return (
    <>
      {/* Desktop Sidebar (Hidden on mobile) */}
      <nav className="hidden md:flex flex-col gap-2 p-4 w-64 border-r border-zinc-200 bg-white/50 backdrop-blur-xl h-screen sticky top-0">
        <div className="px-4 pb-6 pt-4">
          <p className="font-bold tracking-tight text-xl text-zinc-900">SARAH<span className="text-blue-600">.</span></p>
          <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-1">{role} Portal</p>
        </div>
        
        <div className="flex-1 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-4 py-3 text-sm font-medium transition-colors rounded-xl flex items-center gap-3",
                  isActive ? "text-blue-700" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100/50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="desktop-active-indicator"
                    className="absolute inset-0 bg-blue-50 border border-blue-100 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-t border-zinc-200 pb-safe">
        <div className="flex items-center justify-around px-2 h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
                  isActive ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-indicator"
                    className="absolute inset-x-4 -top-[1px] h-[2px] bg-zinc-900 rounded-b-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <item.icon className={cn("w-5 h-5", isActive && "fill-zinc-900/10")} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
