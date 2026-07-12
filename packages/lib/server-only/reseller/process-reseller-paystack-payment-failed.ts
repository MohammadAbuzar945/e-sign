import { releaseResellerCreditReservation } from './reseller-credit-transfer';

export type ProcessResellerPaystackPaymentFailedOptions = {
  paystackReference: string;
  metadata: {
    type?: string;
    resellerCreditTransactionId?: string;
  };
};

export const processResellerPaystackPaymentFailed = async ({
  paystackReference,
  metadata,
}: ProcessResellerPaystackPaymentFailedOptions) => {
  if (metadata.type !== 'reseller-credit-purchase') {
    return { handled: false as const };
  }

  const result = await releaseResellerCreditReservation({
    paystackReference,
    transactionId: metadata.resellerCreditTransactionId,
  });

  return {
    handled: true as const,
    released: result.released,
  };
};
