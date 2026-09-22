"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const GCashSchema = z.object({
  gcashNumber: z.string().regex(/^09\d{9}$/, {
    message: "GCash number must be exactly 11 digits and start with 09.",
  }),
});

export async function updatePayoutMethod(formData: FormData) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const gcashNumber = formData.get("gcashNumber") as string;
    
    // Validate with Zod
    const validatedData = GCashSchema.safeParse({ gcashNumber });
    
    if (!validatedData.success) {
      return { 
        success: false, 
        error: validatedData.error.flatten().fieldErrors.gcashNumber?.[0] || "Invalid GCash number"
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ payout_gcash_number: validatedData.data.gcashNumber })
      .eq("id", user.id);

    if (error) {
      console.error("Supabase update error:", error);
      return { success: false, error: "Failed to update payout method." };
    }

    revalidatePath("/homestay/settings");
    revalidatePath("/resort/settings");
    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function updateNotificationPreferences(pushEnabled: boolean) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ push_enabled: pushEnabled })
      .eq("id", user.id);

    if (error) {
      console.error("Supabase update error:", error);
      return { success: false, error: "Failed to update preferences." };
    }

    revalidatePath("/homestay/settings");
    revalidatePath("/resort/settings");
    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

const ProfileDetailsSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100),
  phoneNumber: z
    .string()
    .trim()
    .regex(
      /^(09\d{9})?$/,
      "Phone number must be an 11-digit Philippine mobile number starting with 09, or left blank."
    )
    .optional()
    .nullable(),
});

export async function updateProfileDetails(payload: {
  fullName: string;
  phoneNumber?: string;
}) {
  try {
    const supabase = (await createClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = ProfileDetailsSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error:
          parsed.error.flatten().fieldErrors.fullName?.[0] ||
          parsed.error.flatten().fieldErrors.phoneNumber?.[0] ||
          "Invalid input data",
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: parsed.data.fullName,
        phone_number: parsed.data.phoneNumber || "",
      })
      .eq("id", user.id);

    if (error) {
      console.error("Supabase profile update error:", error);
      return { success: false, error: "Failed to update profile details." };
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (err) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function updateAccountPasswordAction(newPassword: string) {
  try {
    const supabase = (await createClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    if (!newPassword || newPassword.length < 8) {
      return {
        success: false,
        error: "Password must be at least 8 characters long.",
      };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update password" };
  }
}
