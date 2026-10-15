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
      .update({
        payment_status: "refunded",
        panaw_refund_status: "sent",
        panaw_refund_sent_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) throw error;

    revalidatePath("/admin/transactions");
    revalidatePath("/admin");
    revalidatePath("/bookings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to mark booking as refunded." };
  }
}

/**
 * Administrator cancellation action.
 * Can trigger standard guest cancellation policy or declare force majeure (100% full refund).
 */
export async function adminCancelBookingAction(payload: {
  bookingId: string;
  reason?: string;
  forceMajeure?: boolean;
}) {
  try {
    await assertAdminCaller();
    const { bookingId, reason, forceMajeure } = payload;
    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }

    const supabase = await createClient();
    const { data, error } = await (supabase.rpc as any)("cancel_booking_atomic", {
      p_booking_id: bookingId,
      p_reason: reason || "Administrative cancellation",
      p_force_majeure: forceMajeure ?? false,
      p_refund_gcash_number: null,
    });

    if (error) throw error;

    revalidatePath("/admin/transactions");
    revalidatePath("/admin");
    revalidatePath("/bookings");
    revalidatePath("/homestay/bookings");
    revalidatePath("/resort/bookings");

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to cancel booking." };
  }
}

/**
 * Administrator records Panaw leg refund disbursement (uploads GCash transfer proof).
 */
export async function disbursePanawRefundAction(payload: {
  bookingId: string;
  receiptPath: string;
}) {
  try {
    await assertAdminCaller();
    const { bookingId, receiptPath } = payload;
    if (!bookingId || !receiptPath) {
      return { success: false, error: "Booking ID and receipt path are required." };
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status, host_refund_status, host_refund_amount")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) {
      return { success: false, error: "Booking not found." };
    }

    if (booking.status !== "cancelled") {
      return { success: false, error: "Cannot disburse refund for a non-cancelled booking." };
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      panaw_refund_receipt_url: receiptPath,
      panaw_refund_status: "sent",
      panaw_refund_sent_at: now,
    };

    // If host leg is already sent or zero, mark whole booking as refunded
    const hostDone =
      booking.host_refund_status === "sent" ||
      Number(booking.host_refund_amount || 0) === 0;
    if (hostDone) {
      updatePayload.payment_status = "refunded";
      updatePayload.refunded_at = now;
    }

    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (updateErr) throw updateErr;

    revalidatePath("/admin/transactions");
    revalidatePath("/admin");
    revalidatePath("/bookings");
    revalidatePath("/homestay/bookings");
    revalidatePath("/resort/bookings");

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to disburse Panaw refund." };
  }
}


