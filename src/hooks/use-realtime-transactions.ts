import { useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/**
 * useRealtimeTransactions — subscribes to live booking changes for the admin
 * transactions page.
 *
 * The admin transactions view is driven by `payment_status` and `payout_status`
 * columns on the bookings table. Whenever any booking is updated (e.g. a tourist
 * uploads a GCash receipt → payment_status changes to "deposit_uploaded"),
 * this hook invalidates the `admin-transactions` query key, causing the
 * DataTable to re-render automatically.
 *
 * No filter is applied because the admin watches ALL bookings globally.
 * This hook is admin-only and should only be mounted on the admin transactions page.
 */
export function useRealtimeTransactions() {
  const queryClient = useQueryClient();
  const supabase = useMemo(() => createClient(), []);

  const handleChange = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["admin-transactions"] });
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel("admin_transactions_live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
        },
        handleChange
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bookings",
        },
        handleChange
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Subscribed to admin transactions live feed");
        }
      });

    return () => {
      console.log("[Realtime] Unsubscribing from admin transactions");
      supabase.removeChannel(channel);
    };
  }, [supabase, handleChange]);
}
