export type ResellerBulkRateTierLike = {
  minCredits: number;
  pricePerCreditCents: number;
  isEnabled: boolean;
};

export const matchBulkRateTier = ({
  credits,
  tiers,
}: {
  credits: number;
  tiers: ResellerBulkRateTierLike[];
}): { minCredits: number; pricePerCreditCents: number } | null => {
  const enabled = tiers
    .filter((tier) => tier.isEnabled && tier.minCredits > 0 && tier.pricePerCreditCents > 0)
    .sort((a, b) => a.minCredits - b.minCredits);

  if (enabled.length === 0) {
    return null;
  }

  const matching = [...enabled].reverse().find((tier) => credits >= tier.minCredits);

  if (!matching) {
    return null;
  }

  return {
    minCredits: matching.minCredits,
    pricePerCreditCents: matching.pricePerCreditCents,
  };
};
