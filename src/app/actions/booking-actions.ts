"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyNewBooking } from "@/app/actions/notify-actions";

export async function createReservationAction(payload: {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  serviceIds?: string[];
  notes?: string;
}) {
  try {
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
      .select("base_price, max_capacity, is_active, property_id, properties!property_id(owner_id, name)")
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

    // Fetch the system settings to get the dynamic commission percentage and convenience fee
    const { data: systemSettings, error: settingsError } = await (supabaseUserClient as any)
      .from("system_settings")
      .select("commission_percentage, convenience_fee")
      .eq("id", 1)
      .single();
      
    if (settingsError || !systemSettings) {
      throw new Error("Could not retrieve system settings.");
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
        .select("id, price, commission_rate")
        .in("id", payload.serviceIds);
        
      if (services) {
        services.forEach(service => {
          const sPrice = Number(service.price);
          const sCommRate = service.commission_rate ? Number(service.commission_rate) / 100 : 0.08;
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

    // Downpayment is 20% of final grand total
    const downpaymentAmount = finalGrandTotal * 0.20;
    // Association Commission is dynamically calculated from the room price only
    const roomCommissionAmount = totalPrice * commissionRate;
    const commissionAmount = roomCommissionAmount + addonsCommission;
    // Host payout is room + addons minus their respective commissions
    const hostPayoutAmount = (totalPrice - roomCommissionAmount) + (addonsTotal - addonsCommission);

    // 4. Atomic Insertion via Admin Client
    const supabaseAdmin = createAdminClient();
    
    const { data: insertData, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        tourist_id: user.id,
        room_id: payload.roomId,
        owner_id: ownerId || null,
        check_in_date: payload.checkInDate,
        check_out_date: payload.checkOutDate,
        guest_count: payload.guestCount,
        total_price: finalGrandTotal,
        downpayment_amount: downpaymentAmount,
        commission_amount: commissionAmount,
        host_payout_amount: hostPayoutAmount,
        convenience_fee: convenienceFee,
        payment_status: "awaiting_deposit",
        status: "pending",
        notes: (payload.notes || "").slice(0, 1000)
      } as any)
      .select()
      .single();
    const newBooking = insertData as any;

    if (bookingError) {
      if (bookingError.code === '23P01') {
        throw new Error("These dates are no longer available. The room was booked by someone else.");
      }
      throw new Error(`Booking failed: ${bookingError.message}`);
    }

    // Insert Add-ons if any
    if (addonsData.length > 0 && newBooking.id) {
      const finalAddonsData = addonsData.map(a => ({
        ...a,
        booking_id: newBooking.id
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
        bookingId: newBooking.id,
        ownerId,
        touristName,
        propertyName,
        checkIn: payload.checkInDate,
      }).catch((err) => console.error("[Notify] notifyNewBooking failed:", err));
    }

    return { success: true, booking: newBooking };
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
