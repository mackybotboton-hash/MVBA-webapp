/**
 * Admin Dashboard Metrics Helper
 *
 * Centralized commission, revenue, and action-counter calculations
 * for the Panaw administrative dashboard (full-commission model).
 */

export const DEFAULT_ADMIN_REVENUE_GOAL = 15000;

export interface AdminBookingRow {
  id: string;
  status: string;
  payment_status: string | null;
  payout_status: string | null;
  check_out_date: string;
  commission_amount: number | null;
  convenience_fee: number | null;
  total_price: number | null;
  panaw_refund_status?: string | null;
  host_refund_status?: string | null;
  adjusted_host_payout_amount?: number | null;
}

export interface AdminDashboardMetrics {
  targetGoal: number;
  earnedCommission: number;
  pendingCommission: number;
  remainingToGoal: number;
  progressPercent: number;
  actionCounters: {
    depositsAwaitingVerification: number;
    payoutsDue: number;
    cancellationsAwaitingRefundDecision: number;
  };
}

/**
 * Returns today's date in Asia/Manila as a "YYYY-MM-DD" string.
 */
export function getTodayInManila(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Extracts the YYYY-MM-DD portion safely from date or timestamp strings.
 */
export function extractDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  // If stored as "2026-10-15" or "2026-10-15T00:00:00Z", takes the first 10 characters
  return dateStr.slice(0, 10);
}

export function calculateAdminDashboardMetrics(
  bookings: AdminBookingRow[],
  targetGoal: number = DEFAULT_ADMIN_REVENUE_GOAL
): AdminDashboardMetrics {
  const today = getTodayInManila();

  // 1. Base Filter for Platform Revenue Bookings
  // Payment must be verified/completed, not refunded, and not declined/cancelled/pending
  const isRevenueEligible = (b: AdminBookingRow) =>
    ["verified", "completed"].includes(b.payment_status || "") &&
    b.payment_status !== "refunded" &&
    !["declined", "cancelled", "pending"].includes(b.status);

  let earnedCommission = 0;
  let pendingCommission = 0;

  for (const b of bookings) {
    if (isRevenueEligible(b)) {
      const comm = Number(b.commission_amount || 0);
      const fee = Number(b.convenience_fee || 0);
      const bookingPlatformRevenue = comm + fee;

      const checkout = extractDateString(b.check_out_date);

      // Earned: booking explicitly marked completed OR checkout date has passed in Asia/Manila
      if (b.status === "completed" || checkout < today) {
        earnedCommission += bookingPlatformRevenue;
      } else {
        // Pending: checkout date in the future (or today) and not marked completed
        pendingCommission += bookingPlatformRevenue;
      }
    }
  }

  const remainingToGoal = Math.max(0, targetGoal - earnedCommission);
  const progressPercent = targetGoal > 0
    ? Math.min(100, Math.round((earnedCommission / targetGoal) * 100))
    : 100;

  // 2. Action Counters
  let depositsAwaitingVerification = 0;
  let payoutsDue = 0;
  let cancellationsAwaitingRefundDecision = 0;

  for (const b of bookings) {
    // (a) Deposits awaiting verification: tourist uploaded GCash proof, booking not cancelled/declined
    if (b.payment_status === "deposit_uploaded" && !["cancelled", "declined"].includes(b.status)) {
      depositsAwaitingVerification++;
    }

    // (b) Payouts due:
    // 1) Active booking: verified/completed, not cancelled/declined/refunded, deposit payout not yet sent
    // 2) Cancelled booking with host payout due: adjusted_host_payout_amount > 0 and payout not yet sent
    const activePayoutDue =
      ["verified", "completed"].includes(b.payment_status || "") &&
      !["cancelled", "declined"].includes(b.status) &&
      b.payment_status !== "refunded" &&
      !["deposit_paid", "fully_paid"].includes(b.payout_status || "");

    const cancelledHostPayoutDue =
      b.status === "cancelled" &&
      Number(b.adjusted_host_payout_amount || 0) > 0 &&
      !["deposit_paid", "fully_paid"].includes(b.payout_status || "");

    if (activePayoutDue || cancelledHostPayoutDue) {
      payoutsDue++;
    }

    // (c) Cancelled bookings awaiting refund decision or disbursement
    if (
      b.status === "cancelled" &&
      (b.panaw_refund_status === "pending" ||
        (b.payment_status === "verified" && !["deposit_paid", "fully_paid"].includes(b.payout_status || "")))
    ) {
      cancellationsAwaitingRefundDecision++;
    }
  }

  return {
    targetGoal,
    earnedCommission,
    pendingCommission,
    remainingToGoal,
    progressPercent,
    actionCounters: {
      depositsAwaitingVerification,
      payoutsDue,
      cancellationsAwaitingRefundDecision,
    },
  };
}
