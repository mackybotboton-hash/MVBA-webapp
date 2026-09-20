import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ============================================================================
// useNotificationCounts — global badge counts for nav tabs
// ============================================================================
// Provides live-updating counts for:
//   unreadMessages      — messages where receiver = me and is_read = false
//   unseenBookings      — bookings where owner_id = me and seen_by_host_at IS NULL
//   pendingTransactions — bookings where payment_status = 'deposit_uploaded' (admin)
//
// Each count has a Supabase Realtime subscription that increments/decrements it
// in real time. On mount, an initial DB query fetches the current counts.
// ============================================================================

export interface NotificationCounts {
  unreadMessages: number;
  unseenBookings: number;      // host badge: new, unseen booking requests
  pendingTransactions: number; // admin badge: GCash receipts awaiting verification
}

/**
 * Marks all of the current host's bookings as "seen" by writing seen_by_host_at.
 * Call this when the host navigates to their /bookings page.
 * Returns early and silently if the user is not a host.
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

/**
 * Global hook that subscribes to Supabase Realtime and returns live badge counts.
 *
 * @param userId  The current user's Supabase UUID (from useAuth)
 * @param role    The user's role — controls which counts are relevant
 */
export function useNotificationCounts(
  userId: string | undefined,
  role: "tourist" | "homestay" | "resort" | "admin" | undefined
): NotificationCounts {
  const [counts, setCounts] = useState<NotificationCounts>({
    unreadMessages: 0,
    unseenBookings: 0,
    pendingTransactions: 0,
  });

  const supabase = useMemo(() => createClient(), []);

  // ── Initial fetch ─────────────────────────────────────────────────────────
  const fetchInitialCounts = useCallback(async () => {
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

  // Keep a stable ref to fetchInitialCounts so the realtime effect below can
  // call the latest version without taking it as a dependency (which would
  // cause the effect — and its channel subscriptions — to tear down and
  // re-create on every render cycle, triggering the double-subscribe crash).
  const fetchRef = useRef(fetchInitialCounts);
  useEffect(() => {
    fetchRef.current = fetchInitialCounts;
  });

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !role) return;

    fetchRef.current();

    // Channel names used by this effect instance.
    const MSG_CHANNEL = `badge_messages_${userId}`;
    const BKG_CHANNEL = `badge_bookings_${userId}`;
    const TX_CHANNEL  = "badge_admin_transactions";

    // ── Pre-cleanup: remove any stale channels with these names ──────────────
    // Supabase stores channel topics as "realtime:<name>" internally, so
    // ch.topic will be e.g. "realtime:badge_messages_..." — we must match
    // against the prefixed form or the filter is always a no-op.
    const staleTopics = new Set([
      `realtime:${MSG_CHANNEL}`,
      `realtime:${BKG_CHANNEL}`,
      `realtime:${TX_CHANNEL}`,
    ]);
    supabase
      .getChannels()
      .filter((ch) => staleTopics.has(ch.topic))
      .forEach((ch) => supabase.removeChannel(ch));

    const channels: RealtimeChannel[] = [];

    // ─ Messages channel (all non-admin roles with chat) ──────────────────
    if (role !== "admin") {
      const msgChannel = supabase
        .channel(MSG_CHANNEL)
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
            // When is_read flips to true, decrement the count
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
        .channel(BKG_CHANNEL)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "bookings",
            filter: `owner_id=eq.${userId}`,
          },
          () => {
            // New booking arrived — it's unseen by default (seen_by_host_at is NULL)
            setCounts((prev) => ({
              ...prev,
              unseenBookings: prev.unseenBookings + 1,
            }));
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
            // When seen_by_host_at is set (host opened the bookings page), clear the badge
            if (payload.new?.seen_by_host_at && !payload.old?.seen_by_host_at) {
              // A single row was marked seen — re-fetch to get accurate count
              // (multiple rows may be marked at once by markBookingsAsSeen)
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
        .channel(TX_CHANNEL)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
          },
          () => {
            // Re-fetch the exact count rather than doing arithmetic,
            // because multiple statuses may change simultaneously
            fetchRef.current();
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
          }
        )
        .subscribe();

      channels.push(txChannel);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
    // fetchRef is intentionally excluded — it's a ref that always holds the
    // latest fetchInitialCounts, so the effect doesn't need to re-run (and
    // re-subscribe channels) whenever fetchInitialCounts updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, role, supabase]);

  return counts;
}
