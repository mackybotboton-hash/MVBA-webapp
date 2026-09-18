"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

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
