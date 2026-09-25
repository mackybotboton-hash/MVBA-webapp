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
  unreadSystemNotifications: number;
}

const DEFAULT_COUNTS: NotificationCounts = {
  unreadMessages: 0,
  unseenBookings: 0,
  pendingTransactions: 0,
  unreadSystemNotifications: 0,
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

/**
 * Marks all notifications as read for the current user.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    const supabase = createClient();
    await (supabase.from("notifications") as any)
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
  } catch (err) {
    console.error("[Counts] Failed to mark all notifications as read:", err);
  }
}

/**
 * Deletes all notifications for the current user.
 */
export async function deleteAllNotifications(userId: string): Promise<void> {
  try {
    const supabase = createClient();
    await (supabase.from("notifications") as any)
      .delete()
      .eq("user_id", userId);
  } catch (err) {
    console.error("[Counts] Failed to delete all notifications:", err);
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NotificationCountsProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const userId = user?.id;
  const role = profile?.role;

  const [counts, setCounts] = useState<NotificationCounts>(DEFAULT_COUNTS);
  const supabase = useMemo(() => createClient(), []);

  // -- In-app notification sound (Web Audio API synthesized chime) --
  // Root cause of Bug E (silent on desktop): the old unlock handler called
  // ctx.resume().then(() => ctx.suspend()), leaving the context "suspended".
  // When playSound() later called ctx.resume() outside a user gesture, Chrome
  // silently rejected it. Fix: keep the context RUNNING after the first gesture.
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlock = () => {
      if (audioCtxRef.current) return; // Already unlocked
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        // Resume during the user gesture and KEEP IT RUNNING.
        // Do NOT call ctx.suspend() after this — a suspended context requires
        // another gesture to resume, which breaks Realtime-triggered sounds.
        ctx.resume().catch(() => {});
        audioCtxRef.current = ctx;
      } catch {
        // Web Audio API not supported
      }
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });

    return () => {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    const ctx = audioCtxRef.current;
    // If no context yet (user hasn't interacted), skip silently.
    // This is correct — the browser would block it anyway.
    if (!ctx || ctx.state === "closed") return;

    const play = () => {
      try {
        const now = ctx.currentTime;

        // Tone 1: 880 Hz (A5) — fast attack, exponential decay
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.5, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Tone 2: 1318 Hz (E6) — "ding-dong" second beat
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1318, now + 0.18);
        gain2.gain.setValueAtTime(0, now + 0.18);
        gain2.gain.linearRampToValueAtTime(0.4, now + 0.20);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.55);
      } catch {
        // Ignore oscillator errors (e.g., context closed mid-play)
      }
    };

    if (ctx.state === "running") {
      play();
    } else {
      // Context may be in "suspended" state if browser auto-suspended it.
      // Attempt to resume — this only works if inside or shortly after a gesture.
      ctx.resume().then(play).catch(() => {});
    }
  }, []);

  // ── Initial fetch ───────────────────────────────────────────────────────
  const fetchCounts = useCallback(async () => {
    if (!userId || !role) return;

    try {
      let unreadMessages = 0;
      let unseenBookings = 0;
      let pendingTransactions = 0;
      let unreadSystemNotifications = 0;

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

      // 4. System notifications
      const { count: sysCount } = await (supabase.from("notifications") as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      unreadSystemNotifications = sysCount ?? 0;

      setCounts({ unreadMessages, unseenBookings, pendingTransactions, unreadSystemNotifications });
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

    // -- Messages channel: all roles that have chat (tourist, homestay, resort, AND admin) --
    // Bug B root cause: the old guard was (role !== "admin"), so admin had zero message
    // channels — unreadMessages was always 0 for admin. Admin→Host direction worked because
    // the host's channel received the INSERT. Host→Admin was completely silent on admin side.
    //
    // UPDATE handler bug (bell-reset): payload.old?.is_read is always undefined without
    // REPLICA IDENTITY FULL. The delta check (old.is_read===false) never triggered, so the
    // bell never decremented after messages were read. Fix: full refetch on any UPDATE.
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
        () => {
          // Full refetch rather than delta: payload.old is empty without REPLICA IDENTITY
          // FULL, so (payload.old?.is_read === false) was always false, never decrementing.
          fetchRef.current();
        }
      )
      .subscribe();

    channels.push(msgChannel);

    // ─ System notifications channel (all roles) ─────────────────────────
    const sysChannel = supabase
      .channel(`badge_sys_notifications_${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setCounts((prev) => ({
            ...prev,
            unreadSystemNotifications: prev.unreadSystemNotifications + 1,
          }));
          playSound();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchRef.current();
        }
      )
      .subscribe();

    channels.push(sysChannel);

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
