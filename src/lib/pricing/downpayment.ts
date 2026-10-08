/**
 * Pure function to determine the resolved downpayment percentage based on hierarchy:
 * 1. Room-level override (if set and >= 1)
 * 2. Property-level default (if set and >= 1)
 * 3. Platform default (system_settings.default_downpayment_percent)
 *
 * Then clamp upward to the platform minimum (system_settings.min_downpayment_percent).
 * Falls back to 20% if both system settings are somehow missing.
 *
 * @param roomDownpaymentPercent      Room-level override (nullable)
 * @param propertyDownpaymentPercent  Property-level default (nullable)
 * @param platformDefaultPercent      system_settings.default_downpayment_percent (nullable)
 * @param platformMinPercent          system_settings.min_downpayment_percent (nullable)
 */
export function resolveDownpaymentPercent(
  roomDownpaymentPercent?: number | null,
  propertyDownpaymentPercent?: number | null,
  platformDefaultPercent?: number | null,
  platformMinPercent?: number | null
): number {
  // Step 1: pick the most specific override in hierarchy
  let resolved: number;
  if (typeof roomDownpaymentPercent === "number" && roomDownpaymentPercent >= 1) {
    resolved = roomDownpaymentPercent;
  } else if (typeof propertyDownpaymentPercent === "number" && propertyDownpaymentPercent >= 1) {
    resolved = propertyDownpaymentPercent;
  } else if (typeof platformDefaultPercent === "number" && platformDefaultPercent >= 1) {
    resolved = platformDefaultPercent;
  } else {
    resolved = 20; // Absolute fallback if system settings are missing
  }

  // Step 2: clamp upward to the platform minimum (the floor set by admin)
  const min = (typeof platformMinPercent === "number" && platformMinPercent >= 1) ? platformMinPercent : 1;
  return Math.max(resolved, min);
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
