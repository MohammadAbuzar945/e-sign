import {
  ResellerCreditTransactionStatus,
  ResellerProfileStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { calculateResellerVatAmountInCents } from '@documenso/lib/utils/reseller-vat';

import {
  atomicDecrementOrganisationCredits,
  atomicIncrementOrganisationCredits,
} from './reseller-credit-transfer';

export const coercePaystackMetadataNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const coerced = Number(value);

  if (!Number.isFinite(coerced)) {
    return undefined;
  }

  return coerced;
};

export type ProcessResellerPaystackWebhookOptions = {
  paystackReference: string;
  metadata: {
    type?: string;
    resellerProfileId?: string;
    purchaserOrganisationId?: string;
    purchaserUserId?: number | string;
    packageId?: string;
    expectedAmount?: number | string;
    resellerCreditTransactionId?: string;
  };
  amountInCents: number;
  purchaserEmail: string;
  purchaserName?: string;
};

const findExistingResellerCreditTransaction = async ({
  paystackReference,
  resellerCreditTransactionId,
}: {
  paystackReference: string;
  resellerCreditTransactionId?: string;
}) => {
  if (paystackReference) {
    const transactionByReference = await prisma.resellerCreditTransaction.findUnique({
      where: {
        paystackReference,
      },
    });

    if (transactionByReference) {
      return transactionByReference;
    }
  }

  if (!resellerCreditTransactionId) {
    return null;
  }

  return prisma.resellerCreditTransaction.findUnique({
    where: {
      id: resellerCreditTransactionId,
    },
  });
};

export const processResellerPaystackWebhook = async ({
  paystackReference,
  metadata,
  amountInCents,
  purchaserEmail,
  purchaserName,
}: ProcessResellerPaystackWebhookOptions) => {
  if (metadata.type !== 'reseller-credit-purchase') {
    return { handled: false as const };
  }

  if (!metadata.resellerProfileId || !metadata.purchaserOrganisationId || !metadata.packageId) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Missing reseller purchase metadata',
    });
  }

  const existingTransaction = await findExistingResellerCreditTransaction({
    paystackReference,
    resellerCreditTransactionId: metadata.resellerCreditTransactionId,
  });

  if (existingTransaction?.status === ResellerCreditTransactionStatus.COMPLETED) {
    return { handled: true as const, duplicate: true };
  }

  if (existingTransaction?.status === ResellerCreditTransactionStatus.FAILED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller purchase is no longer available',
    });
  }

  const [profile, pkg, purchaserOrganisation] = await Promise.all([
    prisma.resellerProfile.findUnique({
      where: { id: metadata.resellerProfileId },
      include: { organisation: true },
    }),
    prisma.resellerPackage.findUnique({
      where: { id: metadata.packageId },
    }),
    prisma.organisation.findUnique({
      where: { id: metadata.purchaserOrganisationId },
      include: {
        owner: true,
      },
    }),
  ]);

  if (!profile || profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found or inactive',
    });
  }

  if (!pkg || !pkg.isEnabled || pkg.resellerProfileId !== profile.id) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Package is not available for purchase',
    });
  }

  if (!purchaserOrganisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Purchaser organisation not found',
    });
  }

  const expectedAmount = coercePaystackMetadataNumber(metadata.expectedAmount);
  const purchaserUserId =
    coercePaystackMetadataNumber(metadata.purchaserUserId) ?? purchaserOrganisation.ownerUserId;

  if (pkg.priceInCents !== amountInCents) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Payment amount does not match package price',
    });
  }

  if (expectedAmount !== undefined && expectedAmount !== amountInCents) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Payment amount mismatch',
    });
  }

  const vatAmount = calculateResellerVatAmountInCents(pkg.priceInCents, profile.vatNumber);
  const hasReservedCredits = existingTransaction?.status === ResellerCreditTransactionStatus.PENDING;

  const transaction = await prisma.$transaction(async (tx) => {
    const pendingTransaction =
      existingTransaction ??
      (await tx.resellerCreditTransaction.create({
        data: {
          resellerProfileId: profile.id,
          resellerOrganisationId: profile.organisationId,
          purchaserOrganisationId: purchaserOrganisation.id,
          purchaserUserId,
          packageId: pkg.id,
          paystackReference,
          credits: pkg.creditAmount,
          grossAmount: pkg.priceInCents,
          vatAmount,
          currency: pkg.currency,
          status: ResellerCreditTransactionStatus.PENDING,
          purchaserName: purchaserName ?? purchaserOrganisation.owner.name ?? purchaserEmail,
          purchaserEmail,
          purchaserOrganisationName: purchaserOrganisation.name,
        },
      }));

    const toOrganisation = await tx.organisation.findUniqueOrThrow({
      where: { id: purchaserOrganisation.id },
      select: { ownerUserId: true },
    });

    if (hasReservedCredits) {
      await atomicIncrementOrganisationCredits(tx, {
        organisationId: purchaserOrganisation.id,
        ownerUserId: toOrganisation.ownerUserId,
        amount: pkg.creditAmount,
      });
    } else {
      const fromOrganisation = await tx.organisation.findUniqueOrThrow({
        where: { id: profile.organisationId },
        select: { ownerUserId: true },
      });

      await atomicDecrementOrganisationCredits(tx, {
        organisationId: profile.organisationId,
        ownerUserId: fromOrganisation.ownerUserId,
        amount: pkg.creditAmount,
        allowNegative: profile.allowNegativeCredits,
      });

      await atomicIncrementOrganisationCredits(tx, {
        organisationId: purchaserOrganisation.id,
        ownerUserId: toOrganisation.ownerUserId,
        amount: pkg.creditAmount,
      });
    }

    return await tx.resellerCreditTransaction.update({
      where: { id: pendingTransaction.id },
      data: {
        paystackReference,
        status: ResellerCreditTransactionStatus.COMPLETED,
        completedAt: new Date(),
        vatAmount,
        purchaserName: purchaserName ?? purchaserOrganisation.owner.name ?? purchaserEmail,
        purchaserEmail,
      },
    });
  });

  return { handled: true as const, transaction };
};
