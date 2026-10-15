"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  calculateAdminDashboardMetrics,
  DEFAULT_ADMIN_REVENUE_GOAL,
  type AdminBookingRow,
  type AdminDashboardMetrics,
} from "@/lib/admin-metrics-helper";

/**
 * Enforces strict administrator role verification.
 */
async function assertAdminCaller() {
  const supabaseUserClient = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseUserClient.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Please sign in.");
  }

  const { data: profile, error: profileError } = await supabaseUserClient
    .from("profiles")
    .select("role, is_approved")
    .eq("id", user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin" ||
    !profile.is_approved
  ) {
    throw new Error("Forbidden: Administrator privileges required.");
  }

  return user;
}

/**
 * Server action to fetch dashboard financial & action metrics safely.
 * Non-admins receive an immediate authorization rejection.
 */
export async function getAdminDashboardMetricsAction(): Promise<{
  success: boolean;
  data?: AdminDashboardMetrics;
  error?: string;
}> {
  try {
    await assertAdminCaller();

    const supabaseAdmin = createAdminClient();

    // Select ONLY the exact columns needed for dashboard calculations
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("id, status, payment_status, payout_status, check_out_date, commission_amount, convenience_fee, total_price, panaw_refund_status, adjusted_host_payout_amount");

    if (error) {
      throw error;
    }

    const rows: AdminBookingRow[] = (bookings || []).map((b: any) => ({
      id: b.id,
      status: b.status,
      payment_status: b.payment_status,
      payout_status: b.payout_status,
      check_out_date: b.check_out_date,
      commission_amount: b.commission_amount != null ? Number(b.commission_amount) : 0,
      convenience_fee: b.convenience_fee != null ? Number(b.convenience_fee) : 0,
      total_price: b.total_price != null ? Number(b.total_price) : 0,
      panaw_refund_status: b.panaw_refund_status,
      adjusted_host_payout_amount: b.adjusted_host_payout_amount != null ? Number(b.adjusted_host_payout_amount) : 0,
    }));

    const metrics = calculateAdminDashboardMetrics(rows, DEFAULT_ADMIN_REVENUE_GOAL);

    return {
      success: true,
      data: metrics,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Failed to load admin dashboard metrics.",
    };
  }
}
