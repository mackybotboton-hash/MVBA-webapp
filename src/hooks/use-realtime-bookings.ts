import { useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * useRealtimeBookings — subscribes to live changes on the `bookings` table.
 *
 * When any INSERT or UPDATE fires for bookings belonging to the current user,
 * it invalidates the matching TanStack Query cache key so the UI re-renders
 * without a manual page refresh.
 *
 * For HOSTS: filters by `owner_id` (the denormalized column we added).
 * For TOURISTS: filters by `tourist_id`.
 * For ADMIN: no filter — watches all bookings (pass role="admin").
 *
 * @param userId     The current user's Supabase UUID
 * @param role       The user's role — determines which filter column to use
 * @param queryKeys  Array of TanStack Query keys to invalidate on change
 *                   e.g. ['resort-bookings'] or ['homestay-bookings']
 */
export function useRealtimeBookings(
  userId: string | undefined,
  role: "host" | "tourist" | "admin",
  queryKeys: string[]
) {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const handleChange = useCallback(() => {
    // Invalidate all provided query keys so React Query refetches
    for (const key of queryKeys) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  }, [queryClient, queryKeys]);

  useEffect(() => {
    if (!userId && role !== "admin") return;

    // Build the channel name and optional Realtime filter
    let channelName: string;
    let filterConfig: Record<string, string> | undefined;

    if (role === "admin") {
      channelName = `bookings_admin`;
      filterConfig = undefined; // Admin watches all changes
    } else if (role === "host") {
      channelName = `bookings_host_${userId}`;
      filterConfig = { filter: `owner_id=eq.${userId}` };
    } else {
      channelName = `bookings_tourist_${userId}`;
      filterConfig = { filter: `tourist_id=eq.${userId}` };
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
          ...filterConfig,
        },
        handleChange
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          ...filterConfig,
        },
        handleChange
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`[Realtime] Subscribed to bookings — channel: ${channelName}`);
        }
      });

    return () => {
      console.log(`[Realtime] Unsubscribing from bookings — channel: ${channelName}`);
      supabase.removeChannel(channel);
    };
  }, [userId, role, supabase, handleChange]);
}
