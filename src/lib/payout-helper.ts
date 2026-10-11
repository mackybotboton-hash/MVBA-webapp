export function calculatePayout(params: {
  totalPrice: number;
  downpaymentAmount: number | null | undefined;
  commissionAmount: number | null | undefined;
  convenienceFee: number | null | undefined;
  depositPayoutAmount?: number | null;
}) {
  const fee = params.convenienceFee || 0;
  const downpayment = params.downpaymentAmount || 0;
  const commission = params.commissionAmount || 0;

  // 1. If stored deposit_payout_amount exists, use it directly
  if (params.depositPayoutAmount !== null && params.depositPayoutAmount !== undefined) {
    const depositPayout = Number(params.depositPayoutAmount);
    const balancePayout = Math.max(0, params.totalPrice - downpayment);
    const totalHostPayout = depositPayout + balancePayout;
    return {
      depositPayout,
      commissionOnDeposit: commission,
      balancePayout,
      totalHostPayout,
    };
  }

  // Guard against division by zero and invalid states
  if (params.totalPrice - fee <= 0) {
    return {
      depositPayout: 0,
      commissionOnDeposit: 0,
      balancePayout: 0,
      totalHostPayout: 0,
    };
  }

  // 2. New full-commission formula:
  // Net deposit from guest minus platform commission
  const depositWithoutFee = downpayment > fee ? downpayment - fee : 0;
  const depositPayout = Math.max(0, depositWithoutFee - commission);

  // Balance collected directly from guest at check-in
  const balancePayout = Math.max(0, params.totalPrice - downpayment);
  const totalHostPayout = depositPayout + balancePayout;

  return {
    depositPayout,
    commissionOnDeposit: commission,
    balancePayout,
    totalHostPayout,
  };
}
