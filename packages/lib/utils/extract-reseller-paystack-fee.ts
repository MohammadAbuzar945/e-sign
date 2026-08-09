export type PaystackChargeSuccessFeeSource = {
  fees?: unknown;
  fees_split?: {
    params?: {
      bearer?: string;
    };
    paystack?: unknown;
    subaccount?: unknown;
    integration?: unknown;
  } | null;
  split?: {
    shares?: {
      subaccounts?: Array<{
        fees?: unknown;
        subaccount_code?: string;
      }> | null;
    } | null;
  } | null;
};

const toNonNegativeCents = (value: unknown): number | null => {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount);
};

/**
 * Paystack fee attributed to the reseller subaccount share only.
 *
 * Pure reseller (transaction charge / fees_split): fee on the subaccount bearer.
 * Hybrid split checkout: fee on the matching subaccount entry in split.shares.
 */
export const extractResellerSubaccountPaystackFeeInCents = (
  data: PaystackChargeSuccessFeeSource,
  subaccountCode?: string | null,
): number => {
  const splitSubaccounts = data.split?.shares?.subaccounts;

  if (Array.isArray(splitSubaccounts) && splitSubaccounts.length > 0) {
    const matched = subaccountCode
      ? splitSubaccounts.find((entry) => entry.subaccount_code === subaccountCode)
      : undefined;

    if (matched) {
      return toNonNegativeCents(matched.fees) ?? 0;
    }

    // Only fall back when the caller did not ask for a specific subaccount.
    if (!subaccountCode && splitSubaccounts.length === 1) {
      return toNonNegativeCents(splitSubaccounts[0].fees) ?? 0;
    }

    return 0;
  }

  const feesSplit = data.fees_split;

  if (feesSplit && typeof feesSplit === 'object') {
    const bearer = feesSplit.params?.bearer;

    // Main account bears fees — reseller subaccount is not charged.
    if (bearer === 'account') {
      return 0;
    }

    const paystackFee = toNonNegativeCents(feesSplit.paystack);

    if (paystackFee !== null) {
      return paystackFee;
    }
  }

  return toNonNegativeCents(data.fees) ?? 0;
};
