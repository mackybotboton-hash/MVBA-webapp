"use server";

import { createClient } from "@/lib/supabase/server";

export async function upsertService(payload: {
  id?: string;
  property_id: string;
  name: string;
  service_type: "Boat" | "Food" | "Tour";
  price: number;
}) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Strict Ownership Validation
    const { data: property, error: propError } = await supabase
      .from("properties")
      .select("owner_id")
      .eq("id", payload.property_id)
      .single();

    if (propError || !property) {
      return { success: false, error: "Property not found." };
    }

    if (property.owner_id !== user.id) {
      return { success: false, error: "Forbidden: You do not own this property." };
    }

    const { error: upsertError } = await supabase
      .from("extra_services")
      .upsert({
        ...(payload.id ? { id: payload.id } : {}),
        property_id: payload.property_id,
        name: payload.name,
        service_type: payload.service_type,
        price: payload.price,
        is_active: true
      });

    if (upsertError) {
      console.error("Upsert service error:", upsertError);
      return { success: false, error: "Failed to save service." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function toggleServiceStatus(serviceId: string, isActive: boolean) {
  try {
    const supabase = (await createClient()) as any;
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "Unauthorized" };
    }

    // Verify ownership of the service's property
    const { data: service, error: fetchError } = await supabase
      .from("extra_services")
      .select(`
        id,
        properties (
          owner_id
        )
      `)
      .eq("id", serviceId)
      .single();

    if (fetchError || !service) {
      return { success: false, error: "Service not found." };
    }

    const ownerId = (service as any).properties?.owner_id;
    if (ownerId !== user.id) {
      return { success: false, error: "Forbidden: You do not own this service's property." };
    }

    const { error: updateError } = await supabase
      .from("extra_services")
      .update({ is_active: isActive })
      .eq("id", serviceId);

    if (updateError) {
      console.error("Update service status error:", updateError);
      return { success: false, error: "Failed to update status." };
    }

    return { success: true };
  } catch (err: any) {
    console.error("Action error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}
