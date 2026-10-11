import { calculatePayout } from "./payout-helper";

export function calculateHostMetrics(bookings: any[]) {
  // Exclude refunded bookings from revenue and commission metrics
  const validBookings = bookings.filter(
    (b) =>
      (b.status === "accepted" || b.status === "completed") &&
      b.payment_status !== "refunded"
  );
  
  const grossBookingValue = validBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
  const totalCommission = validBookings.reduce((sum, b) => sum + (b.commission_amount || 0), 0);
  
  // Only calculate net to host (deposit payouts) for bookings that have verified payments
  const verifiedBookings = validBookings.filter(b => 
    b.payment_status === "verified" || b.payment_status === "completed" || b.payment_status === "deposit_uploaded"
  );
  
  const netToHost = verifiedBookings.reduce((sum, b) => {
    const payouts = calculatePayout({
      totalPrice: b.total_price,
      downpaymentAmount: b.downpayment_amount,
      commissionAmount: b.commission_amount,
      convenienceFee: b.convenience_fee,
      depositPayoutAmount: b.deposit_payout_amount,
    });
    return sum + payouts.depositPayout;
  }, 0);

  // Pending Payouts: Only bookings with verified deposits where host deposit payout has NOT been made
  const pendingBookings = validBookings.filter(b => 
    b.payment_status === "verified" && 
    (!b.payout_status || (b.payout_status !== "deposit_paid" && b.payout_status !== "fully_paid"))
  );

  const pendingPayoutAmount = pendingBookings.reduce((sum, b) => {
    const payouts = calculatePayout({
      totalPrice: b.total_price,
      downpaymentAmount: b.downpayment_amount,
      commissionAmount: b.commission_amount,
      convenienceFee: b.convenience_fee,
      depositPayoutAmount: b.deposit_payout_amount,
    });
    return sum + payouts.depositPayout;
  }, 0);

  return {
    grossBookingValue,
    totalCommission,
    netToHost,
    pendingPayoutAmount
  };
}
