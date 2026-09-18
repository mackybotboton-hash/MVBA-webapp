"use server";

import { createClient } from "@/lib/supabase/server";

export async function approveBookingDeposit(bookingId: string) {
  try {
    const supabase = await createClient();
    
    // 1. Verify Authentication and Role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return { success: false, error: "Forbidden: Admin access required." };
    }

    // 2. Fetch the booking for idempotency and notification targeting
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select(`
        id,
        payment_status,
        rooms (
          properties (
            profiles!owner_id (
              onesignal_id
            )
          )
        )
      `)
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: "Booking not found." };
    }

    // Idempotency check: prevent double processing
    if (booking.payment_status === "verified") {
      return { success: true };
    }

    // 3. Atomically update the booking with audit trail
    const { error: updateError } = await supabase
      .from("bookings")
      .update({ 
        payment_status: "verified",
        payout_status: "pending",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Failed to approve booking deposit:", updateError);
      return { success: false, error: "Failed to update booking status." };
    }

    // 4. Trigger OneSignal Push Notification
    const hostProfile = (booking as any).rooms?.properties?.profiles;
    if (hostProfile && hostProfile.onesignal_id) {
      try {
        const payload = {
          app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          include_player_ids: [hostProfile.onesignal_id],
          headings: { en: "Booking Verified!" },
          contents: { en: "Your 12% deposit payout is on the way." },
        };

        const response = await fetch("https://onesignal.com/api/v1/notifications", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.error("OneSignal Notification failed:", await response.text());
        }
      } catch (notifyError) {
        console.error("Error triggering notification:", notifyError);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in approveBookingDeposit:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
