import {
  ResellerCreditTransactionStatus,
  ResellerPayoutMode,
  ResellerProfileStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { calculateResellerVatAmountInCents } from '@documenso/lib/utils/reseller-vat';

import { sendResellerInsufficientCreditsEmail } from './send-reseller-insufficient-credits-email';
import {
  atomicIncrementOrganisationCredits,
  tryAtomicDecrementOrganisationCredits,
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
    payoutMode?: string;
    resellerProfileId?: string;
    purchaserOrganisationId?: string;
    purchaserUserId?: number | string;
    packageId?: string;
    expectedAmount?: number | string;
    subaccountCode?: string;
  };
  amountInCents: number;
  purchaserEmail: string;
  purchaserName?: string;
};

const buildTransactionRecordData = ({
  profile,
  pkg,
  purchaserOrganisation,
  purchaserUserId,
  paystackReference,
  purchaserEmail,
  purchaserName,
  vatAmount,
  payoutMode,
  paystackSubaccountCode,
}: {
  profile: {
    id: string;
    organisationId: string;
  };
  pkg: {
    id: string;
    creditAmount: number;
    priceInCents: number;
    currency: string;
  };
  purchaserOrganisation: {
    id: string;
    name: string;
    owner: {
      name: string | null;
    };
  };
  purchaserUserId: number;
  paystackReference: string;
  purchaserEmail: string;
  purchaserName?: string;
  vatAmount: number;
  payoutMode: ResellerPayoutMode;
  paystackSubaccountCode?: string | null;
}) => ({
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
  payoutMode,
  paystackSubaccountCode: paystackSubaccountCode ?? null,
  purchaserName: purchaserName ?? purchaserOrganisation.owner.name ?? purchaserEmail,
  purchaserEmail,
  purchaserOrganisationName: purchaserOrganisation.name,
});

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
    where: {
      paystackReference,
    },
  });

  if (existingTransaction?.status === ResellerCreditTransactionStatus.COMPLETED) {
    return { handled: true as const, duplicate: true, fulfilled: true as const };
  }

  const [profile, pkg, purchaserOrganisation] = await Promise.all([
    prisma.resellerProfile.findUnique({
      where: { id: metadata.resellerProfileId },
      include: {
        organisation: {
          include: {
            owner: true,
          },
        },
      },
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
  const resolvedPurchaserName =
    purchaserName ?? purchaserOrganisation.owner.name ?? purchaserEmail;

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
  const payoutMode =
    metadata.payoutMode === ResellerPayoutMode.NOMIA_SUBACCOUNT
      ? ResellerPayoutMode.NOMIA_SUBACCOUNT
      : profile.payoutMode === ResellerPayoutMode.NOMIA_SUBACCOUNT
        ? ResellerPayoutMode.NOMIA_SUBACCOUNT
        : ResellerPayoutMode.OWN_PAYSTACK;
  const paystackSubaccountCode =
    typeof metadata.subaccountCode === 'string'
      ? metadata.subaccountCode
      : profile.paystackSubaccountCode;

  const fulfillmentResult = await prisma.$transaction(async (tx) => {
    const transactionRecord =
      existingTransaction ??
      (await tx.resellerCreditTransaction.create({
        data: buildTransactionRecordData({
          profile,
          pkg,
          purchaserOrganisation,
          purchaserUserId,
          paystackReference,
          purchaserEmail,
          purchaserName: resolvedPurchaserName,
          vatAmount,
          payoutMode,
          paystackSubaccountCode,
        }),
      }));

    const [fromOrganisation, toOrganisation] = await Promise.all([
      tx.organisation.findUniqueOrThrow({
        where: { id: profile.organisationId },
        select: { ownerUserId: true },
      }),
      tx.organisation.findUniqueOrThrow({
        where: { id: purchaserOrganisation.id },
        select: { ownerUserId: true },
      }),
    ]);

    const hasTransferredCredits = await tryAtomicDecrementOrganisationCredits(tx, {
      organisationId: profile.organisationId,
      ownerUserId: fromOrganisation.ownerUserId,
      amount: pkg.creditAmount,
      allowNegative: profile.allowNegativeCredits,
    });

    if (!hasTransferredCredits) {
      return {
        transaction: transactionRecord,
        fulfilled: false as const,
        shouldNotifyReseller: !existingTransaction,
      };
    }

    await atomicIncrementOrganisationCredits(tx, {
      organisationId: purchaserOrganisation.id,
      ownerUserId: toOrganisation.ownerUserId,
      amount: pkg.creditAmount,
    });

    const completedTransaction = await tx.resellerCreditTransaction.update({
      where: { id: transactionRecord.id },
      data: {
        status: ResellerCreditTransactionStatus.COMPLETED,
        completedAt: new Date(),
        vatAmount,
        purchaserName: resolvedPurchaserName,
        purchaserEmail,
      },
    });

    return {
      transaction: completedTransaction,
      fulfilled: true as const,
      shouldNotifyReseller: false as const,
    };
  });

  if (!fulfillmentResult.fulfilled && fulfillmentResult.shouldNotifyReseller) {
    await sendResellerInsufficientCreditsEmail({
      resellerOrganisationId: profile.organisationId,
      resellerOrganisationName: profile.organisation.name,
      resellerOwnerEmail: profile.organisation.owner.email,
      resellerOrganisationUrl: profile.organisation.url,
      purchaserName: resolvedPurchaserName,
      purchaserEmail,
      purchaserOrganisationName: purchaserOrganisation.name,
      creditsRequired: pkg.creditAmount,
    }).catch((error) => {
      console.error('[RESELLER]: Failed to send insufficient credits email', error);
    });
  }

  return {
    handled: true as const,
    fulfilled: fulfillmentResult.fulfilled,
    awaitingManualTransfer: !fulfillmentResult.fulfilled,
    transaction: fulfillmentResult.transaction,
  };
};
