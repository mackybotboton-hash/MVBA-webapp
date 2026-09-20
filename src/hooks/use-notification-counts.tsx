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

  // -- In-app notification sound --
  // Uses Web Audio API to synthesize a two-tone chime directly — no file
  // dependency, guaranteed audible at any system volume.
  // The MP3 file in /public/sounds/notification.mp3 is kept as a fallback
  // but was confirmed near-silent on the Mixkit preview download.
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Unlock Web Audio on first user gesture (iOS/Safari autoplay policy).
    // Creating and immediately suspending an AudioContext primes it so
    // subsequent calls to ctx.resume() inside playSound() succeed.
    const unlock = () => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        // Immediately suspend — we just needed to create it during a user gesture
        ctx.resume().then(() => ctx.suspend()).catch(() => {});
      } catch {
        // Not supported
      }
    };
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("touchstart", unlock, { once: true });

    return () => {
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
    };
  }, []);

  const playSound = useCallback(() => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return;

      // Reuse the unlocked context if available, otherwise create a new one
      const ctx = audioCtxRef.current ?? new AudioCtx();
      if (!audioCtxRef.current) audioCtxRef.current = ctx;

      // Resume in case it was suspended (required after user interaction unlock)
      ctx.resume().then(() => {
        const now = ctx.currentTime;

        // Tone 1: 880 Hz (A5) — attack then decay
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.5, now + 0.02);   // fast attack
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35); // decay
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Tone 2: 1318 Hz (E6) — starts slightly after, gives "ding-dong" feel
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1318, now + 0.18);
        gain2.gain.setValueAtTime(0, now + 0.18);
        gain2.gain.linearRampToValueAtTime(0.4, now + 0.20);   // fast attack
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55); // decay
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.18);
        osc2.stop(now + 0.55);
      }).catch(() => {});
    } catch {
      // Fallback to MP3 file if Web Audio API is unavailable
      const a = new Audio("/sounds/notification.mp3");
      a.volume = 1.0;
      a.play().catch(() => {});
    }
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
