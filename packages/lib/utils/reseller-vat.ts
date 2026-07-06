/** South African standard VAT rate applied when a reseller has a VAT number. */
export const RESELLER_VAT_RATE = 0.15;

/**
 * Calculates VAT from a VAT-inclusive gross amount in cents.
 * Returns 0 when the reseller is not VAT registered (no VAT number).
 */
export const calculateResellerVatAmountInCents = (
  grossAmountInCents: number,
  vatNumber?: string | null,
) => {
  if (!vatNumber?.trim()) {
    return 0;
  }

  return Math.round((grossAmountInCents * RESELLER_VAT_RATE) / (1 + RESELLER_VAT_RATE));
};

export const calculateResellerNetAmountInCents = (
  grossAmountInCents: number,
  vatAmountInCents: number,
) => {
  return grossAmountInCents - vatAmountInCents;
};

/** Uses stored VAT when present; otherwise derives from gross when reseller is VAT registered. */
export const resolveResellerVatAmountInCents = (
  grossAmountInCents: number,
  storedVatAmountInCents: number,
  vatNumber?: string | null,
) => {
  if (storedVatAmountInCents > 0) {
    return storedVatAmountInCents;
  }

  return calculateResellerVatAmountInCents(grossAmountInCents, vatNumber);
};

export const formatCentsAsDecimal = (amountInCents: number) => {
  return (amountInCents / 100).toFixed(2);
};
