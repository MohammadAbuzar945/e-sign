import { ResellerCreditTransactionStatus, ResellerProfileStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

import { calculateResellerVatAmountInCents } from '@documenso/lib/utils/reseller-vat';

import {
  atomicDecrementOrganisationCredits,
  releaseResellerCreditReservation,
} from './reseller-credit-transfer';

export type InitializeResellerPurchaseOptions = {
  affiliateSlug: string;
  packageId: string;
  purchaserOrganisationId: string;
  purchaserUserId: number;
  purchaserEmail: string;
};

export const initializeResellerPurchase = async ({
  affiliateSlug,
  packageId,
  purchaserOrganisationId,
  purchaserUserId,
  purchaserEmail,
}: InitializeResellerPurchaseOptions) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { affiliateSlug },
    include: {
      packages: true,
      organisation: true,
    },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller not found',
    });
  }

  if (profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller is not currently accepting purchases',
    });
  }

  const pkg = profile.packages.find((item) => item.id === packageId && item.isEnabled);

  if (!pkg) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Package is not available for purchase',
    });
  }

  if (profile.organisationId === purchaserOrganisationId) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'You cannot purchase credits from your own reseller account',
    });
  }

  const purchaserOrganisation = await prisma.organisation.findUnique({
    where: {
      id: purchaserOrganisationId,
    },
    include: {
      owner: true,
    },
  });

  if (!purchaserOrganisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Purchaser organisation not found',
    });
  }

  const vatAmount = calculateResellerVatAmountInCents(pkg.priceInCents, profile.vatNumber);

  const reservation = await prisma.$transaction(async (tx) => {
    const resellerOrganisation = await tx.organisation.findUniqueOrThrow({
      where: {
        id: profile.organisationId,
      },
      select: {
        ownerUserId: true,
      },
    });

    await atomicDecrementOrganisationCredits(tx, {
      organisationId: profile.organisationId,
      ownerUserId: resellerOrganisation.ownerUserId,
      amount: pkg.creditAmount,
      allowNegative: profile.allowNegativeCredits,
    });

    const pendingTransaction = await tx.resellerCreditTransaction.create({
      data: {
        resellerProfileId: profile.id,
        resellerOrganisationId: profile.organisationId,
        purchaserOrganisationId: purchaserOrganisation.id,
        purchaserUserId,
        packageId: pkg.id,
        credits: pkg.creditAmount,
        grossAmount: pkg.priceInCents,
        vatAmount,
        currency: pkg.currency,
        status: ResellerCreditTransactionStatus.PENDING,
        purchaserName: purchaserOrganisation.owner.name ?? purchaserEmail,
        purchaserEmail,
        purchaserOrganisationName: purchaserOrganisation.name,
      },
    });

    return pendingTransaction;
  });

  const callbackUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}?purchase=success`;

  let reservationReleased = false;

  try {
    const transaction = await createTransaction({
      email: purchaserEmail,
      amount: pkg.priceInCents,
      callback_url: callbackUrl,
      metadata: {
        type: 'reseller-credit-purchase',
        resellerProfileId: profile.id,
        purchaserOrganisationId,
        purchaserUserId,
        packageId: pkg.id,
        expectedAmount: pkg.priceInCents,
        creditAmount: pkg.creditAmount,
        resellerCreditTransactionId: reservation.id,
      },
    });

    if (!transaction.status || !transaction.data) {
      await releaseResellerCreditReservation({
        transactionId: reservation.id,
      });
      reservationReleased = true;

      throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
        message: transaction.message || 'Failed to initialize Paystack transaction',
      });
    }

    await prisma.resellerCreditTransaction.update({
      where: {
        id: reservation.id,
      },
      data: {
        paystackReference: transaction.data.reference,
      },
    });

    return {
      authorizationUrl: transaction.data.authorization_url,
      reference: transaction.data.reference,
      package: pkg,
    };
  } catch (error) {
    if (!reservationReleased) {
      const pendingTransaction = await prisma.resellerCreditTransaction.findUnique({
        where: {
          id: reservation.id,
        },
        select: {
          status: true,
        },
      });

      if (pendingTransaction?.status === ResellerCreditTransactionStatus.PENDING) {
        await releaseResellerCreditReservation({
          transactionId: reservation.id,
        }).catch(() => undefined);
      }
    }

    throw error;
  }
};
