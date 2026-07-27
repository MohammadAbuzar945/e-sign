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

/**
 * Merge global + custom tiers. Custom overrides the same `minCredits`.
 * Only enabled tiers are kept.
 */
export const mergeBulkRateTiers = ({
  customTiers,
  globalTiers,
}: {
  customTiers: ResellerBulkRateTierLike[];
  globalTiers: ResellerBulkRateTierLike[];
}): ResellerBulkRateTierLike[] => {
  const byMinCredits = new Map<number, ResellerBulkRateTierLike>();

  for (const tier of globalTiers) {
    if (!tier.isEnabled || tier.minCredits <= 0 || tier.pricePerCreditCents <= 0) {
      continue;
    }

    byMinCredits.set(tier.minCredits, {
      minCredits: tier.minCredits,
      pricePerCreditCents: tier.pricePerCreditCents,
      isEnabled: true,
    });
  }

  for (const tier of customTiers) {
    if (!tier.isEnabled || tier.minCredits <= 0 || tier.pricePerCreditCents <= 0) {
      continue;
    }

    byMinCredits.set(tier.minCredits, {
      minCredits: tier.minCredits,
      pricePerCreditCents: tier.pricePerCreditCents,
      isEnabled: true,
    });
  }

  return [...byMinCredits.values()].sort((a, b) => a.minCredits - b.minCredits);
};
