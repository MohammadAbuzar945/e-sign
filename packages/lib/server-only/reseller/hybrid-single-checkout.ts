export type HybridCheckoutAmounts = {
  resellerCredits: number;
  nomiaCredits: number;
  resellerAmountInCents: number;
  nomiaAmountInCents: number;
  totalAmountInCents: number;
  totalCredits: number;
};

export const calculateHybridCheckoutAmounts = ({
  packageCreditAmount,
  packagePriceInCents,
  resellerCredits,
  nomiaAmountInCents,
}: {
  packageCreditAmount: number;
  packagePriceInCents: number;
  resellerCredits: number;
  nomiaAmountInCents?: number;
}): HybridCheckoutAmounts => {
  const nomiaCredits = packageCreditAmount - resellerCredits;
  const resellerAmountInCents = Math.round(
    (packagePriceInCents * resellerCredits) / packageCreditAmount,
  );
  const resolvedNomiaAmountInCents =
    nomiaAmountInCents ?? packagePriceInCents - resellerAmountInCents;

  return {
    resellerCredits,
    nomiaCredits,
    resellerAmountInCents,
    nomiaAmountInCents: resolvedNomiaAmountInCents,
    totalAmountInCents: resellerAmountInCents + resolvedNomiaAmountInCents,
    totalCredits: packageCreditAmount,
  };
};

export const buildHybridTransactionCharge = ({
  nomiaAmountInCents,
  resellerAmountInCents,
  platformFeePercent,
}: {
  nomiaAmountInCents: number;
  resellerAmountInCents: number;
  platformFeePercent: number;
}) => {
  const platformFee =
    platformFeePercent > 0
      ? Math.round((resellerAmountInCents * platformFeePercent) / 100)
      : 0;

  return nomiaAmountInCents + platformFee;
};

/**
 * Dynamic Paystack split for hybrid checkout. Nomia keeps `transactionCharge`
 * (via remainder); reseller subaccount gets the rest. Paystack fees are shared
 * proportionally to each party's share (`bearer_type: all-proportional`).
 */
export const buildHybridPaystackSplit = ({
  subaccountCode,
  amountInCents,
  transactionCharge,
}: {
  subaccountCode: string;
  amountInCents: number;
  transactionCharge: number;
}) => {
  const resellerShareInCents = amountInCents - transactionCharge;

  return {
    type: 'flat' as const,
    bearer_type: 'all-proportional' as const,
    subaccounts: [
      {
        subaccount: subaccountCode,
        share: resellerShareInCents,
      },
    ],
  };
};

export const buildNomiaHybridPurchaseReference = (paystackReference: string) =>
  `${paystackReference}#nomia`;
