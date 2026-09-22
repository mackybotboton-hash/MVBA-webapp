"use client";

import { useAuth } from "@/hooks/use-auth";
import { useNotificationCounts } from "@/hooks/use-notification-counts";
import { Logo } from "@/components/shared/logo";
import {
  Bell,
  LogOut,
  Menu,
  User,
  LayoutDashboard,
  Compass,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getInitials } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface TopbarProps {
  onMenuToggle?: () => void;
  title?: string;
}

export function Topbar({ onMenuToggle, title }: TopbarProps) {
  const { profile, user } = useAuth();
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Live badge counts — sourced from the singleton NotificationCountsProvider
  const { unreadMessages, unseenBookings, pendingTransactions } =
    useNotificationCounts();

  // Total bell count: sum up all relevant counts for this role
  const role = profile?.role;
  const bellCount =
    role === "admin"
      ? pendingTransactions
      : role === "homestay" || role === "resort"
      ? unseenBookings + unreadMessages
      : unreadMessages;

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setIsUserMenuOpen(false);
      }
    }
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  async function handleSignOut() {
    setIsUserMenuOpen(false);

    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (!confirmed) return;

    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const portalHomeRoute =
    role === "homestay"
      ? "/homestay"
      : role === "resort"
      ? "/resort"
      : role === "admin"
      ? "/admin"
      : "/";

  const roleBadgeLabel =
    role === "homestay"
      ? "Homestay Host"
      : role === "resort"
      ? "Resort Operator"
      : role === "admin"
      ? "Admin"
      : "Guest";

  const displayName =
    profile?.full_name || profile?.email?.split("@")[0] || "User";
  const initials = profile?.full_name
    ? getInitials(profile.full_name)
    : profile?.email
    ? getInitials(profile.email)
    : "U";

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-gray-200 bg-white">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-3">
          {onMenuToggle && (
            <button
              onClick={onMenuToggle}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors md:hidden"
              aria-label="Toggle menu"
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
          )}
          {title && (
            <h1 className="text-sm font-medium text-gray-900 ml-2 md:ml-0">{title}</h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Live Bell Notification Button */}
          <button
            className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label={`Notifications${bellCount > 0 ? ` (${bellCount} unread)` : ""}`}
          >
            <Bell className="h-5 w-5 text-gray-500" />
            {bellCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 px-[3px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none shadow-sm animate-in zoom-in-75 duration-200">
                {bellCount > 99 ? "99+" : bellCount}
              </span>
            )}
          </button>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* User Profile Trigger & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-label="Toggle user profile menu"
              aria-expanded={isUserMenuOpen}
              className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-gray-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-black/10 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shadow-xs transition-transform group-hover:scale-105">
                {initials}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-sm font-medium text-gray-900 leading-none">
                  {displayName}
                </span>
                <span className="text-[11px] text-gray-400 capitalize leading-none mt-1">
                  {roleBadgeLabel}
                </span>
              </div>
              <ChevronDown
                className={`h-3.5 w-3.5 text-gray-400 transition-transform duration-200 ${
                  isUserMenuOpen ? "rotate-180 text-gray-700" : ""
                }`}
              />
            </button>

            {/* Profile Dropdown Menu */}
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-150">
                {/* User info card */}
                <div className="px-3 py-2.5 border-b border-gray-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {displayName}
                    </p>
                    <Badge
                      variant="subtle"
                      size="sm"
                      className="text-[10px] uppercase font-bold shrink-0 bg-neutral-100 text-neutral-700"
                    >
                      {roleBadgeLabel}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {profile?.email || "Authenticated Account"}
                  </p>
                </div>

                {/* Quick actions */}
                <div className="py-1 space-y-0.5 text-xs">
                  {role !== "admin" && (
                    <Link
                      href={role === "tourist" ? "/profile" : `/${role}/settings`}
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium transition-colors"
                    >
                      <User className="h-4 w-4 text-gray-400" />
                      <span>{role === "tourist" ? "My Account & Profile" : "Host Settings"}</span>
                    </Link>
                  )}

                  <Link
                    href={portalHomeRoute}
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4 text-gray-400" />
                    <span>Portal Dashboard</span>
                  </Link>

                  <Link
                    href="/"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center justify-between px-3 py-2 rounded-xl text-gray-700 hover:bg-gray-50 hover:text-gray-900 font-medium transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Compass className="h-4 w-4 text-gray-400" />
                      <span>Preview Tourist View</span>
                    </div>
                    <ExternalLink className="h-3 w-3 text-gray-400" />
                  </Link>
                </div>

                {/* Sign out item */}
                <div className="pt-1 border-t border-gray-100">
                  <button
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
