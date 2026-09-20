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
  notes?: string;
}) {
  try {
    // 1. Authenticate the caller using standard SSR client (respects cookies)
    const supabaseUserClient = await createClient();
    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      throw new Error("Unauthorized: You must be logged in to create a booking.");
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

    // Fetch the system settings to get the dynamic commission percentage
    const { data: systemSettings, error: settingsError } = await (supabaseUserClient as any)
      .from("system_settings")
      .select("commission_percentage")
      .eq("id", 1)
      .single();
      
    if (settingsError || !systemSettings) {
      throw new Error("Could not retrieve system settings.");
    }
    
    const commissionRate = Number(systemSettings.commission_percentage) / 100;

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
    // Association Commission is dynamically calculated
    const commissionAmount = totalPrice * commissionRate;
    // Host payout is total minus commission
    const hostPayoutAmount = totalPrice - commissionAmount;

    // 4. Atomic Insertion via Admin Client
    // We use the admin client because the exclusion constraint runs at the DB level,
    // and we want this single transaction to succeed or fail atomically without client-side RLS conflicts on overlapping reads.
    const supabaseAdmin = createAdminClient();
    
    const { data: insertData, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        tourist_id: user.id,
        room_id: payload.roomId,
        // Denormalize owner_id so Supabase Realtime can filter without joins
        owner_id: ownerId || null,
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
      } as any)
      .select()
      .single();
    const newBooking = insertData as any;

    if (bookingError) {
      // 23P01 is the PostgreSQL error code for exclusion constraint violation
      if (bookingError.code === '23P01') {
        throw new Error("These dates are no longer available. The room was booked by someone else.");
      }
      throw new Error(`Booking failed: ${bookingError.message}`);
    }

    revalidatePath("/bookings");
    revalidatePath(`/property/${payload.roomId}`);

    // Fire-and-forget: notify host + admin about new booking
    // This is intentionally NOT awaited at the top level — we do not want
    // any notification failure to affect the booking response.
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
