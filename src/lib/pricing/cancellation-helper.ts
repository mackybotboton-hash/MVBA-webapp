/**
 * Shared Cancellation & Refund Policy Helper
 * Generates human-readable descriptions for property pages, terms, and checkout.
 */

export type CancellationPolicyType = "standard" | "flexible" | "non_refundable";

export interface RefundPolicySettings {
  refund_full_days?: number;
  refund_partial_days?: number;
  refund_partial_percent?: number;
  convenience_fee_refund_rule?: string;
  host_refund_deadline_hours?: number;
}

export function formatPolicyName(policy: string | null | undefined): string {
  switch (policy) {
    case "flexible":
      return "Flexible Policy";
    case "non_refundable":
      return "Non-Refundable Policy";
    case "standard":
    default:
      return "Standard Policy";
  }
}

export function getFeeRefundRuleText(rule?: string | null): string {
  switch (rule) {
    case "always":
      return "Convenience fee: 100% refunded on cancellation.";
    case "full_tier_only":
      return "Convenience fee: refunded only if qualifying for a 100% deposit refund.";
    case "never":
    default:
      return "Convenience fee: non-refundable on guest cancellation.";
  }
}

export function getPolicySummary(
  policy: string | null | undefined,
  settings?: RefundPolicySettings | null
): {
  headline: string;
  tier1: string;
  tier2?: string;
  tier3: string;
  feeRuleText: string;
  note: string;
} {
  const fullDays = settings?.refund_full_days ?? 7;
  const partialDays = settings?.refund_partial_days ?? 3;
  const partialPercent = settings?.refund_partial_percent ?? 50;
  const feeRule = settings?.convenience_fee_refund_rule ?? "never";

  const feeRuleText = getFeeRefundRuleText(feeRule);
  const generalNote = "Host cancellations or official Coast Guard gale warnings (Force Majeure) always receive a 100% full refund of all amounts paid.";

  if (policy === "non_refundable") {
    return {
      headline: "Strictly Non-Refundable",
      tier1: "All guest cancellations are non-refundable regardless of notice period.",
      tier3: "0% refund of deposit upon guest cancellation.",
      feeRuleText,
      note: generalNote,
    };
  }

  if (policy === "flexible") {
    return {
      headline: `Flexible: 100% refund up to ${partialDays} days before check-in`,
      tier1: `100% refund of deposit if cancelled ${partialDays} or more days prior to check-in.`,
      tier3: `Non-refundable if cancelled within ${partialDays} days before check-in.`,
      feeRuleText,
      note: generalNote,
    };
  }

  // Standard policy
  return {
    headline: `Standard: 100% refund at ${fullDays}+ days, ${partialPercent}% at ${partialDays}–${fullDays - 1} days`,
    tier1: `100% refund of deposit if cancelled ${fullDays} or more days before check-in.`,
    tier2: `${partialPercent}% refund of deposit if cancelled ${partialDays} to ${fullDays - 1} days before check-in.`,
    tier3: `Non-refundable if cancelled under ${partialDays} days before check-in.`,
    feeRuleText,
    note: generalNote,
  };
}
