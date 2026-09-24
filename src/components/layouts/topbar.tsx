"use client";

import { useAuth } from "@/hooks/use-auth";
import { useNotificationCounts } from "@/hooks/use-notification-counts";
import { Logo } from "@/components/shared/logo";
import {
  Bell,
  LogOut,
  Menu,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { getInitials } from "@/lib/utils";
import { useState, useCallback } from "react";
import Link from "next/link";
import { NotificationsDropdown } from "@/components/shared/notifications-dropdown";

interface TopbarProps {
  onMenuToggle?: () => void;
  title?: string;
}

export function Topbar({ onMenuToggle, title }: TopbarProps) {
  const { profile, user } = useAuth();
  const router = useRouter();

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

  async function handleSignOut() {
    const confirmed = window.confirm("Are you sure you want to sign out?");
    if (!confirmed) return;

    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  // -- Push notification opt-in --
  // Reads the browser Notification.permission API so the button label
  // reflects the real current state. Runs in the browser only.
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">("default");

  const handleEnableNotifications = useCallback(async () => {
    if (typeof window === "undefined") return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const OS = (window as any).OneSignal;
      if (OS?.Slidedown?.promptPush) {
        // force: true overrides OneSignal's "already prompted" check
        await OS.Slidedown.promptPush({ force: true });
      } else {
        // Fallback: native browser API (works without OneSignal SDK loaded)
        await Notification.requestPermission();
      }
      setPushPermission(Notification.permission);
    } catch {
      // Ignore — some browsers throw on requestPermission outside gesture
    }
  }, []);

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
          <NotificationsDropdown />

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* User Profile Static Display */}
          <div className="relative">
            <div
              className="flex items-center gap-2.5 p-1 rounded-xl bg-gray-50/50 border border-gray-100 cursor-default"
            >
              <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                {initials}
              </div>
              <div className="hidden md:flex flex-col text-left pr-3">
                <span className="text-sm font-medium text-gray-900 leading-none">
                  {displayName}
                </span>
                <span className="text-[11px] text-gray-400 capitalize leading-none mt-1">
                  {roleBadgeLabel}
                </span>
              </div>
            </div>
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
