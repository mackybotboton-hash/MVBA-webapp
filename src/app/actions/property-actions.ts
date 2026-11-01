"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { validateMapsUrl } from "@/lib/validate-maps-url";

export async function updatePropertyGoogleMapsUrl(propertyId: string, rawUrl: string | null) {
  try {
    const supabase = (await createClient()) as any;
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    if (!propertyId) {
      return { success: false, error: "Property ID is required." };
    }

    // Server-side validation using shared helper
    const validation = validateMapsUrl(rawUrl);
    if (!validation.ok) {
      return { success: false, error: validation.error };
    }

    // Verify property ownership or admin privileges
    const { data: prop, error: fetchErr } = await supabase
      .from("properties")
      .select("id, owner_id")
      .eq("id", propertyId)
      .maybeSingle();

    if (fetchErr || !prop) {
      return { success: false, error: "Property not found." };
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin = profile?.role === "admin";
    if (prop.owner_id !== user.id && !isAdmin) {
      return { success: false, error: "Forbidden: You do not own this property." };
    }

    const { error: updateErr } = await supabase
      .from("properties")
      .update({ google_maps_url: validation.value })
      .eq("id", propertyId);

    if (updateErr) {
      console.error("Failed to update google_maps_url:", updateErr);
      return { success: false, error: updateErr.message || "Failed to update Google Maps link." };
    }

    revalidatePath(`/property/${propertyId}`);
    revalidatePath("/homestay/profile");
    revalidatePath("/resort/profile");

    return { success: true, googleMapsUrl: validation.value };
  } catch (err: any) {
    console.error("updatePropertyGoogleMapsUrl error:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}
