"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function createOwnerAccount(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fullName = formData.get("fullName") as string;
    const role = formData.get("role") as string;

    if (!email || !password || !fullName || !role) {
      return { success: false, error: "All fields are required." };
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return { 
        success: false, 
        error: "Missing SUPABASE_SERVICE_ROLE_KEY. Please add it to your .env.local file to use this feature." 
      };
    }

    // We must use the Admin API with the Service Role Key to bypass RLS 
    // and avoid logging out the current admin user.
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        }
      }
    );

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm the owner's email
      user_metadata: {
        full_name: fullName,
        role: role,
      }
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Wait 1 second to allow Supabase trigger (if any) to insert into profiles
    await new Promise(res => setTimeout(res, 1000));

    // Force update the profile role just to be completely safe
    if (data.user?.id) {
      await supabaseAdmin
        .from("profiles")
        .update({ role, full_name: fullName, is_approved: true }) // Auto approve them
        .eq("id", data.user.id);
    }

    revalidatePath("/admin");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
