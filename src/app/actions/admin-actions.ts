"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { notifyDepositVerified } from "@/app/actions/notify-actions";

export async function createOwnerAccount(formData: FormData) {
  try {
    // 1. Authenticate caller and verify administrative role
    const supabaseUserClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized: You must be logged in." };
    }

    const { data: callerProfile, error: profileError } = await supabaseUserClient
      .from("profiles")
      .select("role, is_approved")
      .eq("id", user.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      callerProfile.role !== "admin" ||
      !callerProfile.is_approved
    ) {
      return {
        success: false,
        error: "Forbidden: Only approved administrators can create host accounts.",
      };
    }

    // 2. Validate input parameters
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const role = formData.get("role") as string;

    if (!email || !password || !fullName || !role) {
      return { success: false, error: "All fields are required." };
    }

    if (!["homestay", "resort", "admin"].includes(role)) {
      return { success: false, error: "Invalid account role specified." };
    }

    // 3. Use Admin Client to create the owner account securely
    const supabaseAdmin = createAdminClient();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: role,
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Allow database trigger to complete before enforcing profile state
    await new Promise((res) => setTimeout(res, 600));

    if (data.user?.id) {
      await supabaseAdmin
        .from("profiles")
        .update({ role, full_name: fullName, is_approved: true })
        .eq("id", data.user.id);
    }

    revalidatePath("/admin");
    revalidatePath("/admin/users");
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "An unexpected error occurred while creating account.",
    };
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
        tourist_id,
        owner_id,
        payment_status,
        rooms (
          properties (
            name
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

    // 3. Atomically update the booking with audit trail using createAdminClient
    const supabaseAdmin = createAdminClient() as any;

    const { error: updateError } = await supabaseAdmin
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

    // 4. Fire-and-forget notifications to host + tourist
    const propertyName = (booking as any).rooms?.properties?.name || "the property";
    const touristId = (booking as any).tourist_id;
    const ownerId = (booking as any).owner_id;

    if (touristId || ownerId) {
      notifyDepositVerified({
        touristId: touristId || "",
        ownerId: ownerId || "",
        propertyName,
      }).catch((err) => console.error("[Notify] notifyDepositVerified failed:", err));
    }

    return { success: true };
  } catch (err: any) {
    console.error("Unexpected error in approveBookingDeposit:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
