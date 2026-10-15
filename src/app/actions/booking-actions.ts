"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  notifyNewBooking,
  notifyBookingCancelled,
  notifyBookingStatusChange,
  notifyHostRefundRequired,
  notifyHostRefundProofUploaded,
  notifyRefundIssueReported,
} from "@/app/actions/notify-actions";
import { resolveDownpaymentPercent, calculatePaymentBreakdown } from "@/lib/pricing/downpayment";

const ALLOWED_TRANSITIONS = {
  tourist: {
    pending: ["cancelled"],
    accepted: ["cancelled"]
  },
  owner: {
    pending: ["accepted", "declined"],
    accepted: ["cancelled", "completed"]
  }
} as Record<string, Record<string, string[]>>;

export async function createReservationAction(payload: {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  serviceIds?: string[];
  expectedDownpayment: number;
  notes?: string;
  policyAccepted: boolean;
}) {
  try {
    if (!payload.policyAccepted) {
      throw new Error("You must agree to the property cancellation policy to proceed with booking.");
    }
    // 1. Authenticate the caller using standard SSR client (respects cookies)
    const supabaseUserClient = await createClient();
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized: You must be logged in to create a booking.");
    }

    if (!payload.roomId || typeof payload.roomId !== "string") {
      throw new Error("Invalid room ID specified.");
    }

    // Validate guest count boundaries
    if (!Number.isInteger(payload.guestCount) || payload.guestCount < 1) {
      throw new Error("Guest count must be an integer of at least 1.");
    }

    // Validate dates strictly
    const checkIn = new Date(payload.checkInDate);
    const checkOut = new Date(payload.checkOutDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      throw new Error("Invalid check-in or check-out date format.");
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkIn < today) {
      throw new Error("Check-in date cannot be in the past.");
    }

    // Ensure checkOut > checkIn
    if (checkOut <= checkIn) {
      throw new Error("Check-out date must be after check-in date.");
    }

    // Fetch the room and its property (owner) for pricing + denormalization
    const { data, error: roomError } = await supabaseUserClient
      .from("rooms")
      .select("base_price, max_capacity, is_active, property_id, downpayment_percent, properties!property_id(owner_id, name, downpayment_percent)")
      .eq("id", payload.roomId)
      .single();
    const room = data as any;

    if (roomError || !room) {
      throw new Error("Room not found or unavailable.");
    }

    const ownerId: string = room.properties?.owner_id;
    const propertyName: string = room.properties?.name || "the property";

    if (!room.is_active) {
      throw new Error("This room is currently not active for bookings.");
    }

    if (payload.guestCount > room.max_capacity) {
      throw new Error(`Exceeds maximum capacity of ${room.max_capacity} guests.`);
    }

    const supabaseAdmin = createAdminClient();
    
    // Fetch the system settings to get the dynamic commission percentage and convenience fee
    const { data: systemSettings, error: settingsError } = await (supabaseAdmin as any)
      .from("system_settings")
      .select("commission_percentage, addon_commission_percentage, convenience_fee, default_downpayment_percent, min_downpayment_percent")
      .limit(1)
      .single();
      
    if (settingsError || !systemSettings) {
      throw new Error(`Could not retrieve system settings: ${settingsError?.message || 'Not found'}`);
    }
    
    const commissionRate = Number(systemSettings.commission_percentage) / 100;

    // Calculate total price and derivatives server-side
    const timeDiff = checkOut.getTime() - checkIn.getTime();
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    const totalPrice = room.base_price * nights;
    
    // Add-ons Calculation
    let addonsTotal = 0;
    let addonsCommission = 0;
    let addonsData: any[] = [];
    
    if (payload.serviceIds && payload.serviceIds.length > 0) {
      const { data: services } = await supabaseUserClient
        .from("extra_services")
        .select("id, price, commission_rate, property_id")
        .in("id", payload.serviceIds);
        
      if (services) {
        // Phase 1a: Validate addons belong to the room's property
        const invalidAddons = services.filter((s: any) => s.property_id !== room.property_id);
        if (invalidAddons.length > 0) {
          throw new Error("One or more selected extra services do not belong to this property.");
        }
        const defaultAddonCommissionRate = 0.08;

        services.forEach(service => {
          const sPrice = Number(service.price);
          const sCommRate = service.commission_rate ? Number(service.commission_rate) / 100 : defaultAddonCommissionRate;
          addonsTotal += sPrice;
          addonsCommission += sPrice * sCommRate;
          addonsData.push({
            service_id: service.id,
            price_at_booking: sPrice,
            commission_amount: sPrice * sCommRate
          });
        });
      }
    }
    
    // Convenience fee
    const convenienceFee = systemSettings.convenience_fee ? Number(systemSettings.convenience_fee) : 100;
    const finalGrandTotal = totalPrice + addonsTotal + convenienceFee;

    // Resolve downpayment percent and calculate amounts
    // Hierarchy: room override → property default → platform default → clamped to platform min
    const resolvedPercent = resolveDownpaymentPercent(
      room.downpayment_percent,
      room.properties?.downpayment_percent,
      systemSettings.default_downpayment_percent,
      systemSettings.min_downpayment_percent,
      systemSettings.commission_percentage,
      systemSettings.addon_commission_percentage
    );

    const breakdown = calculatePaymentBreakdown(totalPrice + addonsTotal, resolvedPercent, convenienceFee);
    const downpaymentAmount = breakdown.expectedDownpayment;
    
    if (!payload.expectedDownpayment) {
      throw new Error("Missing expected downpayment amount from client.");
    }
    
    // Price-drift guard (allow a small epsilon for float conversion anomalies if any, though centavos math should be exact)
    if (Math.abs(payload.expectedDownpayment - downpaymentAmount) > 0.01) {
      throw new Error(`Nagbago ang payment terms (Expected: ₱${payload.expectedDownpayment}, Server: ₱${downpaymentAmount}). Paki-review ulit.`);
    }

    // Association Commission is dynamically calculated from the room price only
    const roomCommissionAmount = totalPrice * commissionRate;
    const commissionAmount = roomCommissionAmount + addonsCommission;
    // Host payout is room + addons minus their respective commissions
    const hostPayoutAmount = (totalPrice - roomCommissionAmount) + (addonsTotal - addonsCommission);

    // Safety guard to ensure deposit covers all platform fees (using centavos to avoid float drift)
    const depositCents = Math.round((downpaymentAmount - convenienceFee) * 100);
    const commissionCents = Math.round(commissionAmount * 100);
    if (depositCents < commissionCents) {
      console.error(`Deposit too low guard triggered. Deposit (no fee): ₱${(depositCents/100).toFixed(2)}, Commission: ₱${(commissionCents/100).toFixed(2)}`);
      throw new Error("This booking can't be created right now. Please try another option or contact support");
    }

    // 4. Atomic Insertion via Admin Client using RPC v2 (Phase 1a Fix)
    
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("request_booking_atomic_v2", {
      p_tourist_id: user.id,
      p_room_id: payload.roomId,
      p_check_in: payload.checkInDate,
      p_check_out: payload.checkOutDate,
      p_guest_count: payload.guestCount,
      p_total_price: finalGrandTotal,
      p_downpayment_amount: downpaymentAmount,
      p_downpayment_percent: breakdown.effectivePercent,
      p_commission_amount: commissionAmount,
      p_host_payout_amount: hostPayoutAmount,
      p_convenience_fee: convenienceFee,
      p_notes: (payload.notes || "").slice(0, 1000)
    });

    if (rpcErr) {
      if (rpcErr.message.includes("bookings_tourist_id_fkey")) {
        throw new Error("Your user profile is incomplete or missing. Please log out and log in again, or contact support.");
      }
      throw new Error(`Booking RPC failed: ${rpcErr.message}`);
    }
    
    if (!rpcRes || !rpcRes.success) {
      throw new Error(rpcRes?.message || "These dates are no longer available. The room was booked by someone else.");
    }

    const newBookingId = rpcRes.booking_id;

    // Record policy_accepted_at timestamp via admin client with retry and safeguard
    if (newBookingId) {
      const nowIso = new Date().toISOString();
      let updateRes = await supabaseAdmin
        .from("bookings")
        .update({ policy_accepted_at: nowIso })
        .eq("id", newBookingId);

      // Retry once if the first attempt failed
      if (updateRes.error) {
        console.warn(`Initial policy_accepted_at update failed for booking ${newBookingId}, retrying once...`, updateRes.error);
        updateRes = await supabaseAdmin
          .from("bookings")
          .update({ policy_accepted_at: nowIso })
          .eq("id", newBookingId);
      }

      // If still failing after retry, mark booking as cancelled (status only, no refund fields)
      if (updateRes.error) {
        console.error(`Failed to record policy acceptance for booking ${newBookingId} after retry:`, updateRes.error);
        await supabaseAdmin
          .from("bookings")
          .update({ status: "cancelled", cancellation_reason: "Failed to record policy acceptance agreement timestamp" })
          .eq("id", newBookingId);

        throw new Error("Unable to confirm policy acceptance agreement. The booking request could not be completed. Please try again.");
      }
    }

    // Insert Add-ons if any
    if (addonsData.length > 0 && newBookingId) {
      const finalAddonsData = addonsData.map(a => ({
        ...a,
        booking_id: newBookingId
      }));
      await supabaseAdmin.from("booking_addons").insert(finalAddonsData);
    }

    revalidatePath("/bookings");
    revalidatePath(`/property/${payload.roomId}`);

    if (ownerId) {
      const touristProfile = await supabaseUserClient
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const touristName = (touristProfile.data as any)?.full_name || "A tourist";

      notifyNewBooking({
        bookingId: newBookingId,
        ownerId,
        touristName,
        propertyName,
        checkIn: payload.checkInDate,
      }).catch((err) => console.error("[Notify] notifyNewBooking failed:", err));
    }

    return { success: true, booking: { id: newBookingId } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Authorized Server Action for submitting a GCash deposit receipt.
 * Validates ownership, format, and status before updating the booking.
 */
export async function submitDepositReceiptAction(payload: {
  bookingId: string;
  receiptPath: string;
  referenceNumber: string;
}) {
  try {
    const supabaseUser = await createClient();
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: Please sign in." };
    }

    if (!payload.bookingId || !payload.receiptPath || !payload.referenceNumber) {
      return { success: false, error: "Missing required booking or receipt information." };
    }

    // Sanitize reference number (digits only, 10–20 digits)
    const sanitizedRef = payload.referenceNumber.replace(/\D/g, "");
    if (sanitizedRef.length < 10 || sanitizedRef.length > 20) {
      return { success: false, error: "GCash reference number must be between 10 and 20 digits." };
    }

    // Path safety validation
    if (payload.receiptPath.includes("..") || /[\0\r\n]/.test(payload.receiptPath)) {
      return { success: false, error: "Invalid receipt storage path." };
    }

    const supabaseAdmin = createAdminClient();

    // Verify booking ownership and valid status
    const { data: booking, error: fetchError } = await supabaseAdmin
      .from("bookings")
      .select("id, tourist_id, owner_id, payment_status, status, rooms(properties(name))")
      .eq("id", payload.bookingId)
      .single();

    if (fetchError || !booking) {
      return { success: false, error: "Booking not found." };
    }

    if (booking.tourist_id !== user.id) {
      return { success: false, error: "Forbidden: You do not own this booking." };
    }

    if (booking.payment_status === "verified") {
      return { success: false, error: "Deposit for this booking has already been verified." };
    }

    if (booking.status === "cancelled" || booking.status === "declined") {
      return { success: false, error: "Cannot submit deposit for a cancelled or declined booking." };
    }

    // Atomically update payment status and receipt reference
    const { error: updateError } = await supabaseAdmin
      .from("bookings")
      .update({
        payment_status: "deposit_uploaded",
        receipt_url: `${payload.receiptPath}|${sanitizedRef}`,
      } as any)
      .eq("id", payload.bookingId);

    if (updateError) {
      console.error("Failed to update booking receipt:", updateError);
      return { success: false, error: "Failed to record payment receipt." };
    }

    revalidatePath("/bookings");
    revalidatePath("/admin/transactions");

    return { success: true };
  } catch (err: any) {
    console.error("Error in submitDepositReceiptAction:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Server Action to fetch room availability (booked dates and blocked calendar events).
 * Uses admin client to bypass RLS, allowing tourists to see booked dates by other users.
 */
export async function getRoomAvailabilityAction(roomId: string) {
  try {
    const supabaseAdmin = createAdminClient();
    
    const { data: bookingsData, error: bookingsError } = await supabaseAdmin
      .from("bookings")
      .select("id, check_in_date, check_out_date, status")
      .eq("room_id", roomId)
      .in("status", ["accepted", "pending", "completed"]);

    if (bookingsError) throw bookingsError;

    const { data: eventsData, error: eventsError } = await supabaseAdmin
      .from("calendar_events")
      .select("id, start_date, end_date")
      .eq("room_id", roomId);

    if (eventsError) throw eventsError;

    const mergedRanges = [
      ...(bookingsData || []),
      ...(eventsData || []).map((e: any) => ({
        id: e.id,
        check_in_date: e.start_date,
        check_out_date: e.end_date,
        status: "accepted", // Force block
      }))
    ];
    
    return { success: true, data: mergedRanges };
  } catch (error: any) {
    console.error("Error in getRoomAvailabilityAction:", error);
    return { success: false, error: error.message };
  }
}

export type CancelBookingPayload =
  | string
  | {
      bookingId: string;
      reason?: string;
      refundGcashNumber?: string;
      forceMajeure?: boolean;
    };

/**
 * Preview / estimate cancellation refund breakdown for a booking before cancelling.
 * Calls public.estimate_cancellation_refund(uuid).
 */
export async function estimateCancellationRefundAction(bookingId: string) {
  try {
    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Unauthorized: Please sign in." };
    }

    const { data, error } = await (supabase.rpc as any)(
      "estimate_cancellation_refund",
      { p_booking_id: bookingId }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      return { success: false, error: "Unable to calculate refund estimate." };
    }

    return {
      success: true,
      data: {
        tier: row.tier as string,
        deposit_refund: Number(row.deposit_refund || 0),
        fee_refund: Number(row.fee_refund || 0),
        refund_total: Number(row.refund_total || 0),
        host_leg: Number(row.host_leg || 0),
        panaw_leg: Number(row.panaw_leg || 0),
        adjusted_host_payout: Number(row.adjusted_host_payout || 0),
        days_before: Number(row.days_before || 0),
        snapshot_source: row.snapshot_source as string,
        reason: row.reason as string,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to estimate refund.",
    };
  }
}

/**
 * Atomic cancellation action for tourist, host, or admin.
 * Uses cancel_booking_atomic RPC with financial recalculation, leg isolation,
 * idempotency, and tamper guards.
 */
export async function cancelBookingAction(
  payload: CancelBookingPayload
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const bookingId = typeof payload === "string" ? payload : payload.bookingId;
    const reason =
      typeof payload === "string"
        ? "Cancelled by user"
        : payload.reason || "Cancelled by user";
    const refundGcashNumber =
      typeof payload === "string" ? null : payload.refundGcashNumber || null;
    const forceMajeure =
      typeof payload === "string" ? false : payload.forceMajeure || false;

    if (!bookingId) {
      return { success: false, error: "Booking ID is required." };
    }

    // GCash number sanitization and check if provided
    let sanitizedGcash: string | null = null;
    if (refundGcashNumber) {
      sanitizedGcash = refundGcashNumber.replace(/[\s-]/g, "");
      if (!/^09\d{9}$/.test(sanitizedGcash)) {
        return {
          success: false,
          error: "Invalid GCash number format. Must be an 11-digit number starting with 09.",
        };
      }
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: "Unauthorized: Please sign in." };
    }

    // Call atomic cancellation engine
    const { data: result, error: rpcErr } = await (supabase.rpc as any)(
      "cancel_booking_atomic",
      {
        p_booking_id: bookingId,
        p_reason: reason,
        p_force_majeure: forceMajeure,
        p_refund_gcash_number: sanitizedGcash,
      }
    );

    if (rpcErr) {
      return { success: false, error: rpcErr.message };
    }

    // Fetch booking details for notifications
    const supabaseAdmin = createAdminClient();
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("tourist_id, check_in_date, rooms!inner(name, properties!inner(name, owner_id))")
      .eq("id", bookingId)
      .single();

    if (booking) {
      const propertyName =
        (booking.rooms as any)?.properties?.name ||
        (booking.rooms as any)?.name ||
        "Bretania Island Stay";
      const ownerId = (booking.rooms as any)?.properties?.owner_id;
      const touristId = booking.tourist_id;
      const checkIn = booking.check_in_date;

      if (user.id === touristId && ownerId) {
        // Tourist cancelled -> notify property host
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("full_name")
          .eq("id", touristId)
          .single();

        notifyBookingCancelled({
          ownerId,
          touristName: profile?.full_name || "Guest",
          propertyName,
          checkIn,
        }).catch((e) => console.error("[Notify] cancel notify failed:", e));

        // If host was already paid out, notify host that deposit return is due
        if (result && Number(result.host_refund_amount || 0) > 0) {
          notifyHostRefundRequired({
            ownerId,
            propertyName,
            guestName: profile?.full_name || "Guest",
            amount: Number(result.host_refund_amount),
            dueAt: result.host_refund_due_at,
          }).catch((e) => console.error("[Notify] host refund required notify failed:", e));
        }
      } else if (user.id === ownerId && touristId) {
        // Host cancelled -> notify tourist
        notifyBookingStatusChange({
          touristId,
          newStatus: "cancelled",
          propertyName,
          checkIn,
        }).catch((e) => console.error("[Notify] host cancel notify failed:", e));

        // If host was already paid out and cancelled themselves, notify host of deposit return due
        if (result && Number(result.host_refund_amount || 0) > 0) {
          const { data: touristProfile } = await supabaseAdmin
            .from("profiles")
            .select("full_name")
            .eq("id", touristId)
            .single();

          notifyHostRefundRequired({
            ownerId,
            propertyName,
            guestName: touristProfile?.full_name || "Guest",
            amount: Number(result.host_refund_amount),
            dueAt: result.host_refund_due_at,
          }).catch((e) => console.error("[Notify] host refund required notify failed:", e));
        }
      }
    }

    revalidatePath("/bookings");
    revalidatePath("/homestay/bookings");
    revalidatePath("/resort/bookings");
    revalidatePath("/admin/transactions");
    revalidatePath("/admin");

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to cancel booking.",
    };
  }
}

/**
 * Host/Owner can update booking status.
 * If transitioning to 'cancelled', delegates directly to cancelBookingAction
 * to ensure 100% guest refund and host payout leg return rules are computed.
 */
export async function updateBookingStatusAction(
  bookingId: string,
  newStatus: string,
  cancellationReason?: string
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    if (newStatus === "cancelled") {
      return await cancelBookingAction({
        bookingId,
        reason: cancellationReason || "Host cancelled booking",
      });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("status, rooms!inner(properties!inner(owner_id))")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) throw new Error("Booking not found");

    // Check ownership
    const ownerId = (booking.rooms as any).properties.owner_id;
    if (ownerId !== user.id) throw new Error("Forbidden: Not your property");

    const allowed = ALLOWED_TRANSITIONS.owner[booking.status] || [];
    if (!allowed.includes(newStatus)) {
      throw new Error(`Invalid status transition from ${booking.status} to ${newStatus}`);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: newStatus } as any)
      .eq("id", bookingId);

    if (updateErr) throw new Error(updateErr.message);

    revalidatePath("/homestay/bookings");
    revalidatePath("/resort/bookings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Complete booking via QR check-in or manual.
 */
export async function completeBookingAction(bookingId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("status, rooms!inner(properties!inner(owner_id))")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) throw new Error("Booking not found");
    
    // Check ownership
    const ownerId = (booking.rooms as any).properties.owner_id;
    if (ownerId !== user.id) throw new Error("Forbidden: Not your property");

    const allowed = ALLOWED_TRANSITIONS.owner[booking.status] || [];
    if (!allowed.includes("completed")) {
      throw new Error(`Invalid status transition to completed from ${booking.status}`);
    }

    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "completed" } as any)
      .eq("id", bookingId);

    if (updateErr) throw new Error(updateErr.message);

    revalidatePath("/homestay/bookings");
    revalidatePath("/resort/bookings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Host submits proof of returning their payout leg for a cancelled booking.
 */
export async function submitHostRefundProofAction(payload: {
  bookingId: string;
  receiptPath: string;
}) {
  try {
    const { bookingId, receiptPath } = payload;
    if (!bookingId || !receiptPath) {
      return { success: false, error: "Booking ID and receipt path are required." };
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return { success: false, error: "Unauthorized: Please sign in." };
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("id, status, host_refund_amount, panaw_refund_status, panaw_refund_amount, rooms!inner(properties!inner(owner_id))")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) {
      return { success: false, error: "Booking not found." };
    }

    const ownerId = (booking.rooms as any)?.properties?.owner_id;
    if (ownerId !== user.id) {
      return { success: false, error: "Forbidden: Not your property." };
    }

    if (booking.status !== "cancelled") {
      return { success: false, error: "Cannot submit refund proof for a non-cancelled booking." };
    }

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      host_refund_receipt_url: receiptPath,
      host_refund_status: "sent",
      host_refund_sent_at: now,
    };

    // If panaw leg is already sent or zero, mark whole booking as refunded
    const panawDone =
      booking.panaw_refund_status === "sent" ||
      Number(booking.panaw_refund_amount || 0) === 0;
    if (panawDone) {
      updatePayload.payment_status = "refunded";
      updatePayload.refunded_at = now;
    }

    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (updateErr) throw updateErr;

    // Fire-and-forget: Notify admins that host submitted deposit return proof
    const { data: hostProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", ownerId)
      .single();

    const propertyName =
      (booking.rooms as any)?.properties?.name || "Bretania Property";

    notifyHostRefundProofUploaded({
      bookingId,
      propertyName,
      hostName: hostProfile?.full_name || "Host",
      amount: Number(booking.host_refund_amount || 0),
    }).catch((e) => console.error("[Notify] host proof notify failed:", e));

    revalidatePath("/homestay/bookings");
    revalidatePath("/resort/bookings");
    revalidatePath("/admin/transactions");
    revalidatePath("/bookings");

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to submit host refund proof.",
    };
  }
}

/**
 * Tourist or host reports an issue/dispute regarding a cancellation refund.
 */
export async function reportRefundIssueAction(payload: {
  bookingId: string;
  reason: string;
}) {
  try {
    const { bookingId, reason } = payload;
    if (!bookingId || !reason?.trim()) {
      return { success: false, error: "Booking ID and explanation are required." };
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) {
      return { success: false, error: "Unauthorized: Please sign in." };
    }

    const supabaseAdmin = createAdminClient();
    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("id, tourist_id, rooms!inner(properties!inner(owner_id))")
      .eq("id", bookingId)
      .single();

    if (fetchErr || !booking) {
      return { success: false, error: "Booking not found." };
    }

    const ownerId = (booking.rooms as any)?.properties?.owner_id;
    if (booking.tourist_id !== user.id && ownerId !== user.id) {
      return { success: false, error: "Forbidden: Not your booking." };
    }

    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({
        refund_issue_reported_at: new Date().toISOString(),
        refund_issue_reason: reason.trim().slice(0, 500),
      })
      .eq("id", bookingId);

    if (updateErr) throw updateErr;

    // Fire-and-forget: Notify admins that an issue or dispute was reported
    const { data: reporterProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    const reportedPropName =
      (booking.rooms as any)?.properties?.name || "Bretania Property";

    notifyRefundIssueReported({
      bookingId,
      reporterName: reporterProfile?.full_name || (user.id === booking.tourist_id ? "Guest" : "Host"),
      propertyName: reportedPropName,
      reason: reason.trim(),
    }).catch((e) => console.error("[Notify] report issue notify failed:", e));

    revalidatePath("/bookings");
    revalidatePath("/homestay/bookings");
    revalidatePath("/resort/bookings");
    revalidatePath("/admin/transactions");

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to report refund issue.",
    };
  }
}


