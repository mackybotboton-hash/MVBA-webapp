"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function verifyDepositAction(bookingId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ payment_status: "verified" })
      .eq("id", bookingId);

    if (error) throw error;
    
    revalidatePath("/admin/transactions");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function markPayoutPaidAction(bookingId: string) {
  try {
    const { error } = await supabaseAdmin
      .from("bookings")
      .update({ payout_status: "paid" })
      .eq("id", bookingId);

    if (error) throw error;
    
    revalidatePath("/admin/transactions");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
