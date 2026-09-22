"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Secure Server Action to generate a short-lived signed URL for a payment receipt.
 * Validates authentication and verifies that the caller is:
 * 1. An approved administrator, OR
 * 2. The tourist who made the booking, OR
 * 3. The property host / owner for the booking or association dues.
 */
export async function getSignedReceiptUrl(storagePath: string) {
  try {
    if (!storagePath || typeof storagePath !== "string") {
      return null;
    }

    // 1. Authenticate the caller session
    const supabaseUser = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      console.warn("[Security] Unauthorized attempt to access payment receipt URL without session.");
      return null;
    }

    // 2. Fetch user profile to check administrative privileges
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("role, is_approved")
      .eq("id", user.id)
      .maybeSingle<{ role: string; is_approved: boolean }>();

    let isAuthorized = false;

    // Approved admins can inspect any receipt for audit & verification
    if (profile?.role === "admin" && profile?.is_approved) {
      isAuthorized = true;
    } else {
      // 3. Check if caller is the tourist or host linked to this booking receipt
      const supabaseAdmin = createAdminClient();
      
      const { data: bookingMatch } = await supabaseAdmin
        .from("bookings")
        .select("id, tourist_id, owner_id")
        .like("receipt_url", `%${storagePath}%`)
        .limit(1);

      const booking = bookingMatch?.[0] as { tourist_id?: string; owner_id?: string } | undefined;

      if (booking && (booking.tourist_id === user.id || booking.owner_id === user.id)) {
        isAuthorized = true;
      } else {
        // Also check association dues receipts for hosts
        const { data: duesMatch } = await supabaseAdmin
          .from("association_dues")
          .select("id, owner_id")
          .like("receipt_url", `%${storagePath}%`)
          .limit(1);

        const dues = duesMatch?.[0] as { owner_id?: string } | undefined;
        if (dues && dues.owner_id === user.id) {
          isAuthorized = true;
        }
      }
    }

    if (!isAuthorized) {
      console.warn(`[Security] User ${user.id} denied access to receipt at path: ${storagePath}`);
      return null;
    }

    // 4. Generate signed URL with 60-minute expiry
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.storage
      .from("payment-receipts")
      .createSignedUrl(storagePath, 3600);

    if (error) {
      console.error("Failed to generate signed URL for receipt:", error);
      return null;
    }

    return data?.signedUrl || null;
  } catch (error) {
    console.error("Exception in getSignedReceiptUrl:", error);
    return null;
  }
}
