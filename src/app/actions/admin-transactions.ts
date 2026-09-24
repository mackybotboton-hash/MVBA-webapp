"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function assertAdminCaller() {
  const supabaseUserClient = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseUserClient.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const { data: profile, error: profileError } = await supabaseUserClient
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    !profile.is_approved
  ) {
    throw new Error("Forbidden: Administrator privileges required.");
  }

  return user;
}

export async function verifyDepositAction(bookingId: string) {
  try {
    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }

    // Enforce administrative authorization
    await assertAdminCaller();

    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "verified" })
      .eq("id", bookingId);

    if (error) throw error;

    revalidatePath("/admin/transactions");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to verify deposit." };
  }
}

export async function markPayoutPaidAction(bookingId: string, payoutReceiptUrl: string) {
  try {
    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }

    // Enforce administrative authorization
    await assertAdminCaller();

    const supabaseAdmin = createAdminClient();

    const { data: booking, error: fetchError } = await supabaseAdmin
      .from("bookings")
      .select("receipt_url")
      .eq("id", bookingId)
      .single();
      
    if (fetchError) throw fetchError;
    
    const newReceiptUrl = booking.receipt_url 
      ? `${booking.receipt_url}||payout:${payoutReceiptUrl}` 
      : `payout:${payoutReceiptUrl}`;
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ 
        payout_status: "paid",
        receipt_url: newReceiptUrl
      })
      .eq("id", bookingId);

    if (error) throw error;

    revalidatePath("/admin/transactions");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update payout status." };
  }
}
