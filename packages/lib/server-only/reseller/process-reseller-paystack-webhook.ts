import {
  ResellerApplicationStatus,
  ResellerCreditTransactionStatus,
  ResellerProfileStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { calculateResellerVatAmountInCents } from '@documenso/lib/utils/reseller-vat';

export type ProcessResellerPaystackWebhookOptions = {
  paystackReference: string;
  metadata: {
    type?: string;
    resellerProfileId?: string;
    purchaserOrganisationId?: string;
    purchaserUserId?: number;
    packageId?: string;
    expectedAmount?: number;
  };
  amountInCents: number;
  purchaserEmail: string;
  purchaserName?: string;
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

  const existingTransaction = await prisma.resellerCreditTransaction.findUnique({
    where: { paystackReference },
  });

  if (existingTransaction?.status === ResellerCreditTransactionStatus.COMPLETED) {
    return { handled: true as const, duplicate: true };
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

  if (pkg.priceInCents !== amountInCents) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Payment amount does not match package price',
    });
  }

  if (metadata.expectedAmount && metadata.expectedAmount !== amountInCents) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Payment amount mismatch',
    });
  }

  const purchaserUserId = metadata.purchaserUserId ?? purchaserOrganisation.ownerUserId;
  const vatAmount = calculateResellerVatAmountInCents(pkg.priceInCents, profile.vatNumber);

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

    const fromOrganisation = await tx.organisation.findUniqueOrThrow({
      where: { id: profile.organisationId },
      select: { ownerUserId: true },
    });

    const toOrganisation = await tx.organisation.findUniqueOrThrow({
      where: { id: purchaserOrganisation.id },
      select: { ownerUserId: true },
    });

    let fromCredits = await tx.userCredits.findFirst({
      where: {
        organisationId: profile.organisationId,
        isActive: true,
      },
    });

    if (!fromCredits) {
      fromCredits = await tx.userCredits.create({
        data: {
          userId: fromOrganisation.ownerUserId,
          organisationId: profile.organisationId,
          credits: 0,
          isActive: true,
        },
      });
    }

    if (!profile.allowNegativeCredits && fromCredits.credits < pkg.creditAmount) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Insufficient reseller credits',
      });
    }

    let toCredits = await tx.userCredits.findFirst({
      where: {
        organisationId: purchaserOrganisation.id,
        isActive: true,
      },
    });

    if (!toCredits) {
      toCredits = await tx.userCredits.create({
        data: {
          userId: toOrganisation.ownerUserId,
          organisationId: purchaserOrganisation.id,
          credits: 0,
          isActive: true,
        },
      });
    }

    await tx.userCredits.update({
      where: { id: fromCredits.id },
      data: {
        credits: fromCredits.credits - pkg.creditAmount,
        lastUpdatedAt: new Date(),
      },
    });

    await tx.userCredits.update({
      where: { id: toCredits.id },
      data: {
        credits: toCredits.credits + pkg.creditAmount,
        lastUpdatedAt: new Date(),
      },
    });

    return await tx.resellerCreditTransaction.update({
      where: { id: pendingTransaction.id },
      data: {
        status: ResellerCreditTransactionStatus.COMPLETED,
        completedAt: new Date(),
        vatAmount,
      },
    });
  });

  return { handled: true as const, transaction };
};

export const rejectResellerApplication = async ({
  applicationId,
  rejectionReason,
}: {
  applicationId: string;
  rejectionReason?: string;
}) => {
  return await prisma.resellerApplication.update({
    where: { id: applicationId },
    data: {
      status: ResellerApplicationStatus.REJECTED,
      rejectedAt: new Date(),
      rejectionReason,
    },
  });
};
