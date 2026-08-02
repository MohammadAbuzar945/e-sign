import {
  NOMIA_VAT_PRICING_MODE,
  NOMIA_VAT_RATE,
  type NomiaVatPricingMode,
} from '../constants/nomia-vat';

/** @deprecated Prefer NOMIA_VAT_RATE — kept for existing imports. */
export const RESELLER_VAT_RATE = NOMIA_VAT_RATE;

export type VatSellerStatus = 'NOT_REGISTERED' | 'REGISTERED' | null | undefined;

export type CalculateVatOptions = {
  /** Gross (inclusive mode) or net (exclusive mode) amount in cents. */
  amountInCents: number;
  /** Seller VAT registration — never derive from the buyer. */
  sellerVatStatus?: VatSellerStatus;
  /**
   * @deprecated Prefer sellerVatStatus. When status is omitted, a non-empty
   * vatNumber is treated as registered for backward compatibility.
   */
  vatNumber?: string | null;
  pricingMode?: NomiaVatPricingMode;
  vatRate?: number;
};

export const isSellerVatRegistered = ({
  sellerVatStatus,
  vatNumber,
}: {
  sellerVatStatus?: VatSellerStatus;
  vatNumber?: string | null;
}) => {
  if (sellerVatStatus === 'REGISTERED') {
    return true;
  }

  if (sellerVatStatus === 'NOT_REGISTERED') {
    return false;
  }

  // Legacy fallback when status was not stored.
  return Boolean(vatNumber?.trim());
};

/**
 * Splits an amount into net + VAT for a VAT-registered seller.
 * Non-VAT sellers always get vatAmount = 0 and net = amount.
 *
 * INCLUSIVE: `amountInCents` is the total paid (VAT included).
 * EXCLUSIVE: `amountInCents` is the net; VAT is added on top (gross = net + vat).
 */
export const calculateVatBreakdownInCents = ({
  amountInCents,
  sellerVatStatus,
  vatNumber,
  pricingMode = NOMIA_VAT_PRICING_MODE,
  vatRate = NOMIA_VAT_RATE,
}: CalculateVatOptions) => {
  const safeAmount = Math.max(0, Math.round(amountInCents));

  if (!isSellerVatRegistered({ sellerVatStatus, vatNumber }) || safeAmount === 0) {
    return {
      pricingMode,
      vatRate: 0,
      netAmountInCents: safeAmount,
      vatAmountInCents: 0,
      grossAmountInCents: safeAmount,
    };
  }

  if (pricingMode === 'EXCLUSIVE') {
    const vatAmountInCents = Math.round(safeAmount * vatRate);

    return {
      pricingMode,
      vatRate,
      netAmountInCents: safeAmount,
      vatAmountInCents,
      grossAmountInCents: safeAmount + vatAmountInCents,
    };
  }

  // Inclusive: extract VAT from gross.
  const vatAmountInCents = Math.round((safeAmount * vatRate) / (1 + vatRate));
  const netAmountInCents = safeAmount - vatAmountInCents;

  return {
    pricingMode,
    vatRate,
    netAmountInCents,
    vatAmountInCents,
    grossAmountInCents: safeAmount,
  };
};

/**
 * Calculates VAT from a VAT-inclusive gross amount in cents.
 * Returns 0 when the seller is not VAT registered.
 */
export const calculateResellerVatAmountInCents = (
  grossAmountInCents: number,
  vatNumber?: string | null,
  sellerVatStatus?: VatSellerStatus,
) => {
  return calculateVatBreakdownInCents({
    amountInCents: grossAmountInCents,
    vatNumber,
    sellerVatStatus,
    pricingMode: 'INCLUSIVE',
  }).vatAmountInCents;
};

export const calculateResellerNetAmountInCents = (
  grossAmountInCents: number,
  vatAmountInCents: number,
) => {
  return grossAmountInCents - vatAmountInCents;
};

/** Uses stored VAT when present and seller is VAT registered; otherwise derives or returns 0. */
export const resolveResellerVatAmountInCents = (
  grossAmountInCents: number,
  storedVatAmountInCents: number,
  vatNumber?: string | null,
  sellerVatStatus?: VatSellerStatus,
) => {
  if (!isSellerVatRegistered({ sellerVatStatus, vatNumber })) {
    return 0;
  }

  if (storedVatAmountInCents > 0) {
    return storedVatAmountInCents;
  }

  return calculateResellerVatAmountInCents(grossAmountInCents, vatNumber, sellerVatStatus);
};

export const formatCentsAsDecimal = (amountInCents: number) => {
  return (amountInCents / 100).toFixed(2);
};
