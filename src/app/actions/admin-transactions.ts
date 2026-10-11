"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

import { calculatePayout } from "@/lib/payout-helper";

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

export async function markPayoutPaidAction(bookingId: string, payoutReceiptUrl: string, payoutStage: "deposit" | "balance") {
  try {
    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }

    // Enforce administrative authorization
    await assertAdminCaller();

    const supabaseAdmin = createAdminClient();

    const { data: booking, error: fetchError } = await supabaseAdmin
      .from("bookings")
      .select("receipt_url, payout_status, total_price, downpayment_amount, commission_amount, convenience_fee, deposit_payout_amount")
      .eq("id", bookingId)
      .single();
      
    if (fetchError || !booking) throw fetchError || new Error("Booking not found");
    
    // We can append multiple receipts using the pipe delimiter
    const newReceiptUrl = booking.receipt_url 
      ? `${booking.receipt_url}||${payoutStage}_payout:${payoutReceiptUrl}` 
      : `${payoutStage}_payout:${payoutReceiptUrl}`;
      
    const nextStatus = payoutStage === "deposit" ? "deposit_paid" : "fully_paid";

    const updatePayload: Record<string, any> = {
      payout_status: nextStatus,
      receipt_url: newReceiptUrl,
    };

    // Server-side compute deposit_payout_amount ONLY for deposit payout, and never overwrite existing value
    if (payoutStage === "deposit") {
      if (booking.deposit_payout_amount === null || booking.deposit_payout_amount === undefined) {
        const payouts = calculatePayout({
          totalPrice: Number(booking.total_price),
          downpaymentAmount: Number(booking.downpayment_amount),
          commissionAmount: Number(booking.commission_amount),
          convenienceFee: Number(booking.convenience_fee || 0),
        });
        updatePayload.deposit_payout_amount = payouts.depositPayout;
      }
    }

    const { error } = await supabaseAdmin
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (error) throw error;

    revalidatePath("/admin/transactions");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update payout status." };
  }
}

export async function markBookingRefundedAction(bookingId: string) {
  try {
    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }

    // Enforce administrative authorization
    await assertAdminCaller();

    const supabaseAdmin = createAdminClient();

    const { data: booking, error: fetchError } = await supabaseAdmin
      .from("bookings")
      .select("status, payment_status, payout_status")
      .eq("id", bookingId)
      .single();

    if (fetchError || !booking) throw fetchError || new Error("Booking not found");

    // Idempotent: if already marked refunded, return success
    if (booking.payment_status === "refunded") {
      return { success: true };
    }

    // Only allow when cancelled + verified
    if (booking.status !== "cancelled" || booking.payment_status !== "verified") {
      return {
        success: false,
        error: "Only cancelled bookings with verified deposits can be marked as refunded.",
      };
    }

    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "refunded" })
      .eq("id", bookingId);

    if (error) throw error;

    revalidatePath("/admin/transactions");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark booking as refunded." };
  }
}
