"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function createOwnerAccount(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const role = formData.get("role") as string;

    if (!email || !password || !fullName || !role) {
      return { success: false, error: "All fields are required." };
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return { 
        success: false, 
        error: "Missing SUPABASE_SERVICE_ROLE_KEY. Please add it to your .env.local file to use this feature." 
      };
    }

    // We must use the Admin API with the Service Role Key to bypass RLS 
    // and avoid logging out the current admin user.
    const supabaseAdmin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    ) as any;

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the owner's email
      user_metadata: {
        full_name: fullName,
        role: role,
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Wait 1 second to allow Supabase trigger (if any) to insert into profiles
    await new Promise(res => setTimeout(res, 1000));

    // Force update the profile role just to be completely safe
    if (data.user?.id) {
      await supabaseAdmin
        .from("profiles")
        .update({ role, full_name: fullName, is_approved: true }) // Auto approve them
        .eq("id", data.user.id);
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

export async function approveBookingDeposit(bookingId: string) {
  try {
    const supabase = (await createClient()) as any;
    
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
