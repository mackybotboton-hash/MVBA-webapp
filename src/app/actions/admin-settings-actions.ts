"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const SystemSettingsSchema = z.object({
  commissionPercentage: z.coerce.number().min(0).max(100, "Percentage must be between 0 and 100"),
  adminGcashNumber: z.string().regex(/^09\d{9}$/, {
    message: "GCash number must be exactly 11 digits and start with 09.",
  }),
  adminGcashName: z.string().min(2, "Name must be at least 2 characters long"),
});

export async function getSystemSettings() {
  try {
    const supabase = await createClient();
    
    // Select the singleton row (id = 1)
    const { data, error } = await supabase
      .from("system_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error("Failed to fetch system settings:", error);
      return { success: false, error: "Failed to fetch settings." };
    }

    return { success: true, settings: data };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function updateSystemSettings(payload: z.infer<typeof SystemSettingsSchema>) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify admin role explicitly
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return { success: false, error: "Forbidden: Admin access required." };
    }

    // Validate payload
    const validatedData = SystemSettingsSchema.safeParse(payload);
    
    if (!validatedData.success) {
      return { 
        success: false, 
        error: "Validation failed: " + Object.values(validatedData.error.flatten().fieldErrors).join(", ")
      };
    }

    // Update the singleton row (id = 1)
    const { error: updateError } = await supabase
      .from("system_settings")
      .update({
        commission_percentage: validatedData.data.commissionPercentage,
        admin_gcash_number: validatedData.data.adminGcashNumber,
        admin_gcash_name: validatedData.data.adminGcashName,
      })
      .eq("id", 1);

    if (updateError) {
      console.error("Supabase update error:", updateError);
      return { success: false, error: "Failed to update system settings." };
    }

    // Revalidate relevant paths
    revalidatePath("/admin/settings");
    revalidatePath("/bookings"); // where GCash number might be displayed
    
    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
