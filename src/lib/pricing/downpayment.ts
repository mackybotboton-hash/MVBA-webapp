/**
 * Pure function to determine the resolved downpayment percentage based on hierarchy:
 * 1. Room-level override (if set and >= 1)
 * 2. Property-level default (if set and >= 1)
 * 3. Platform default (from system_settings)
 * 
 * Falls back to 20% if system setting is somehow missing.
 */
export function resolveDownpaymentPercent(
  roomDownpaymentPercent?: number | null,
  propertyDownpaymentPercent?: number | null,
  systemMinDownpaymentPercent?: number | null
): number {
  if (typeof roomDownpaymentPercent === "number" && roomDownpaymentPercent >= 1) {
    return roomDownpaymentPercent;
  }
  if (typeof propertyDownpaymentPercent === "number" && propertyDownpaymentPercent >= 1) {
    return propertyDownpaymentPercent;
  }
  
  return (typeof systemMinDownpaymentPercent === "number" && systemMinDownpaymentPercent >= 1) 
    ? systemMinDownpaymentPercent 
    : 20; // Absolute fallback
}

/**
 * Pure function to calculate payment breakdown using integer centavos to avoid floating point drift.
 * All internal math is done on integers. Returns values divided by 100 for normal peso representation.
 * 
 * @param totalPrice The total price of the booking (room + addons, excluding convenience fee)
 * @param downpaymentPercent The resolved downpayment percentage (1 to 100)
 * @param convenienceFee The platform convenience fee (added entirely to the downpayment)
 * @returns Object containing expectedDownpayment, balance, and the percent used
 */
export function calculatePaymentBreakdown(
  totalPrice: number,
  downpaymentPercent: number,
  convenienceFee: number
) {
  // Convert to integer centavos
  const totalCents = Math.round(totalPrice * 100);
  const feeCents = Math.round(convenienceFee * 100);
  
  // Clamp percent between 1 and 100
  const clampedPercent = Math.max(1, Math.min(100, downpaymentPercent));
  
  // Calculate downpayment for the base total
  // E.g. totalCents * 20 / 100
  const baseDepositCents = Math.round((totalCents * clampedPercent) / 100);
  
  // The actual amount to pay now includes the convenience fee
  const dueNowCents = baseDepositCents + feeCents;
  
  // Balance is whatever remains from the total price (fees are not part of the balance)
  const balanceCents = totalCents - baseDepositCents;
  
  return {
    expectedDownpayment: dueNowCents / 100,
    expectedBalance: balanceCents / 100,
    effectivePercent: clampedPercent
  };
}
