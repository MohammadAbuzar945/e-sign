import { OrganisationCreditPurchaseType } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createPendingOrganisationCreditPurchase } from '@documenso/lib/server-only/billing/record-organisation-credit-purchase';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { prisma } from '@documenso/prisma';

import { resolveResellerBulkRate } from './resolve-reseller-bulk-rate';

export type InitializeResellerBulkPurchaseOptions = {
  organisationId: string;
  userId: number;
  purchaserEmail: string;
  credits: number;
};

export const initializeResellerBulkPurchase = async ({
  organisationId,
  userId,
  purchaserEmail,
  credits,
}: InitializeResellerBulkPurchaseOptions) => {
  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: {
      id: true,
      url: true,
      ownerUserId: true,
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Organisation not found' });
  }

  if (organisation.ownerUserId !== userId) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Only organisation owners can buy bulk inventory',
    });
  }

  const resolved = await resolveResellerBulkRate({
    organisationId,
    credits,
  });

  const callbackUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/o/${organisation.url}/price-plan?purchase=success&bulk=1`;

  const transaction = await createTransaction({
    email: purchaserEmail,
    amount: resolved.amountInCents,
    callback_url: callbackUrl,
    metadata: {
      type: 'reseller-bulk-purchase',
      value: resolved.credits,
      organisationId,
      bulkRatePerCreditCents: resolved.ratePerCreditCents,
      bulkRateSource: resolved.source,
      minCreditsMatched: resolved.minCreditsMatched,
    },
  });

  if (!transaction.status || !transaction.data) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: transaction.message || 'Failed to initialize bulk purchase',
    });
  }

  await createPendingOrganisationCreditPurchase({
    paystackReference: transaction.data.reference,
    organisationId,
    userId,
    credits: resolved.credits,
    grossAmount: resolved.amountInCents,
    purchaseType: OrganisationCreditPurchaseType.BULK,
  });

  return {
    authorizationUrl: transaction.data.authorization_url,
    reference: transaction.data.reference,
    credits: resolved.credits,
    amountInCents: resolved.amountInCents,
    ratePerCreditCents: resolved.ratePerCreditCents,
    source: resolved.source,
  };
};
