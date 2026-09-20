"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ============================================================================
// NotificationCounts — global singleton badge counts for nav tabs
// ============================================================================
// Provides live-updating counts for:
//   unreadMessages      — messages where receiver = me and is_read = false
//   unseenBookings      — bookings where owner_id = me and seen_by_host_at IS NULL
//   pendingTransactions — bookings where payment_status = 'deposit_uploaded' (admin)
//
// Mounted once via <NotificationCountsProvider> at the app root. All layout
// components consume via useNotificationCounts() — a thin useContext wrapper.
// This guarantees exactly ONE set of Supabase Realtime channels per session.
// ============================================================================

export interface NotificationCounts {
  unreadMessages: number;
  unseenBookings: number;      // host badge: new, unseen booking requests
  pendingTransactions: number; // admin badge: GCash receipts awaiting verification
}

const DEFAULT_COUNTS: NotificationCounts = {
  unreadMessages: 0,
  unseenBookings: 0,
  pendingTransactions: 0,
};

const NotificationCountsContext = createContext<NotificationCounts>(DEFAULT_COUNTS);

// -- Provider --

/**
 * Marks all of the current host's bookings as "seen" by writing seen_by_host_at.
 * Call this when the host navigates to their /bookings page.
 */
export async function markBookingsAsSeen(userId: string): Promise<void> {
  try {
    const supabase = createClient();
    await (supabase.from("bookings") as any)
      .update({ seen_by_host_at: new Date().toISOString() })
      .eq("owner_id", userId)
      .is("seen_by_host_at", null);
  } catch (err) {
    console.error("[Counts] Failed to mark bookings as seen:", err);
  }
}

/**
 * Marks a single notification as read in the notifications table.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    const supabase = createClient();
    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("id", notificationId);
  } catch (err) {
    console.error("[Counts] Failed to mark notification as read:", err);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationCountsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const role = profile?.role;

  const [counts, setCounts] = useState<NotificationCounts>(DEFAULT_COUNTS);
  const supabase = useMemo(() => createClient(), []);

  // ── In-app notification sound ────────────────────────────────────────────
  // Source: Mixkit "correct answer tone" (mixkit-correct-answer-tone-2870)
  // License: Mixkit Free License — royalty-free, no attribution required.
  // Initialized lazily on first use; kept in a ref to avoid re-renders.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Create Audio instance once on mount
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/sounds/notification.mp3");
      audioRef.current.volume = 0.5;

      // Unlock audio playback on first user interaction (iOS/Safari autoplay policy).
      // A silent .play().pause() primes the AudioContext so subsequent calls succeed.
      const unlock = () => {
        const a = audioRef.current;
        if (!a) return;
        const p = a.play();
        if (p !== undefined) {
          p.then(() => a.pause()).catch(() => {});
        }
        document.removeEventListener("click", unlock);
        document.removeEventListener("touchstart", unlock);
      };
      document.addEventListener("click", unlock, { once: true });
      document.addEventListener("touchstart", unlock, { once: true });
    }
    return () => {
      audioRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    // Reset to start so rapid events each play from the beginning
    a.currentTime = 0;
    a.play().catch(() => {
      // Browser autoplay policy may block before first user interaction — silent fail
    });
  }, []);

  // ── Initial fetch ───────────────────────────────────────────────────────
  const fetchCounts = useCallback(async () => {
    if (!userId || !role) return;

    try {
      let unreadMessages = 0;
      let unseenBookings = 0;
      let pendingTransactions = 0;

      // 1. Unread messages (all roles that have chat)
      if (role !== "admin") {
        const { count } = await (supabase.from("messages") as any)
          .select("id", { count: "exact", head: true })
          .eq("receiver_id", userId)
          .eq("is_read", false);
        unreadMessages = count ?? 0;
      }

      // 2. Unseen booking requests (host roles only)
      if (role === "homestay" || role === "resort") {
        const { count } = await (supabase.from("bookings") as any)
          .select("id", { count: "exact", head: true })
          .eq("owner_id", userId)
          .is("seen_by_host_at", null);
        unseenBookings = count ?? 0;
      }

      // 3. Pending transactions awaiting admin verification
      if (role === "admin") {
        const { count } = await (supabase.from("bookings") as any)
          .select("id", { count: "exact", head: true })
          .eq("payment_status", "deposit_uploaded")
          .neq("status", "cancelled");
        pendingTransactions = count ?? 0;
      }

      setCounts({ unreadMessages, unseenBookings, pendingTransactions });
    } catch (err) {
      console.error("[Counts] Initial fetch failed:", err);
    }
  }, [userId, role, supabase]);

  // Stable ref so the realtime callbacks always call the latest fetch
  // without being listed as a dependency of the subscription effect.
  const fetchRef = useRef(fetchCounts);
  useEffect(() => {
    fetchRef.current = fetchCounts;
  });

  // ── Realtime subscriptions ─────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !role) return;

    fetchRef.current();

    const channels: RealtimeChannel[] = [];

    // ─ Messages channel (all non-admin roles with chat) ──────────────────
    if (role !== "admin") {
      const msgChannel = supabase
        .channel(`badge_messages_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${userId}`,
          },
          () => {
            setCounts((prev) => ({
              ...prev,
              unreadMessages: prev.unreadMessages + 1,
            }));
            playSound();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `receiver_id=eq.${userId}`,
          },
          (payload: any) => {
            if (payload.new?.is_read === true && payload.old?.is_read === false) {
              setCounts((prev) => ({
                ...prev,
                unreadMessages: Math.max(0, prev.unreadMessages - 1),
              }));
            }
          }
        )
        .subscribe();

      channels.push(msgChannel);
    }

    // ─ Unseen bookings channel (host roles) ──────────────────────────────
    if (role === "homestay" || role === "resort") {
      const bookingChannel = supabase
        .channel(`badge_bookings_${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bookings",
            filter: `owner_id=eq.${userId}`,
          },
          () => {
            setCounts((prev) => ({
              ...prev,
              unseenBookings: prev.unseenBookings + 1,
            }));
            playSound();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
            filter: `owner_id=eq.${userId}`,
          },
          (payload: any) => {
            if (payload.new?.seen_by_host_at && !payload.old?.seen_by_host_at) {
              fetchRef.current();
            }
          }
        )
        .subscribe();

      channels.push(bookingChannel);
    }

    // ─ Pending transactions channel (admin only) ─────────────────────────
    if (role === "admin") {
      const txChannel = supabase
        .channel("badge_admin_transactions")
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
          },
          () => {
            fetchRef.current();
            playSound();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bookings",
          },
          () => {
            fetchRef.current();
            playSound();
          }
        )
        .subscribe();

      channels.push(txChannel);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, supabase]);

  return (
    <NotificationCountsContext.Provider value={counts}>
      {children}
    </NotificationCountsContext.Provider>
  );
}

// -- Consumer hook --

/**
 * Returns live badge counts from the singleton NotificationCountsProvider.
 * Must be called from within a <NotificationCountsProvider>.
 */
export function useNotificationCounts(): NotificationCounts {
  return useContext(NotificationCountsContext);
}
