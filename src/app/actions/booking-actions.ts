"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createReservationAction(payload: {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  guestCount: number;
  notes?: string;
}) {
  try {
    // 1. Authenticate the caller using standard SSR client (respects cookies)
    const supabaseUserClient = await createClient();
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized: You must be logged in to create a booking.");
    }

    // 2. Fetch the room's base price from the database securely.
    // Client payload pricing is explicitly ignored to prevent tampering.
    const { data: room, error: roomError } = await supabaseUserClient
      .from("rooms")
      .select("base_price, max_capacity, is_active")
      .eq("id", payload.roomId)
      .single();

    if (roomError || !room) {
      throw new Error("Room not found or unavailable.");
    }

    if (!room.is_active) {
      throw new Error("This room is currently not active for bookings.");
    }

    if (payload.guestCount > room.max_capacity) {
      throw new Error(`Exceeds maximum capacity of ${room.max_capacity} guests.`);
    }

    // 3. Calculate total price and derivatives server-side
    const checkIn = new Date(payload.checkInDate);
    const checkOut = new Date(payload.checkOutDate);
    
    // Ensure checkOut > checkIn
    if (checkOut <= checkIn) {
      throw new Error("Check-out date must be after check-in date.");
    }

    const timeDiff = checkOut.getTime() - checkIn.getTime();
    const nights = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    const totalPrice = room.base_price * nights;
    // Downpayment is 20%
    const downpaymentAmount = totalPrice * 0.20;
    // Association Commission is 8% of total price
    const commissionAmount = totalPrice * 0.08;
    // Host payout is total minus commission
    const hostPayoutAmount = totalPrice - commissionAmount;

    // 4. Atomic Insertion via Admin Client
    // We use the admin client because the exclusion constraint runs at the DB level,
    // and we want this single transaction to succeed or fail atomically without client-side RLS conflicts on overlapping reads.
    const supabaseAdmin = createAdminClient();
    
    const { data: newBooking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        tourist_id: user.id,
        room_id: payload.roomId,
        check_in_date: payload.checkInDate,
        check_out_date: payload.checkOutDate,
        guest_count: payload.guestCount,
        total_price: totalPrice,
        downpayment_amount: downpaymentAmount,
        commission_amount: commissionAmount,
        host_payout_amount: hostPayoutAmount,
        payment_status: "awaiting_deposit",
        status: "pending",
        notes: payload.notes || ""
      })
      .select()
      .single();

    if (bookingError) {
      // 23P01 is the PostgreSQL error code for exclusion constraint violation
      if (bookingError.code === '23P01') {
        throw new Error("These dates are no longer available. The room was booked by someone else.");
      }
      throw new Error(`Booking failed: ${bookingError.message}`);
    }

    revalidatePath("/bookings");
    revalidatePath(`/property/${payload.roomId}`); // Replace with actual path struct if different

    return { success: true, booking: newBooking };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
