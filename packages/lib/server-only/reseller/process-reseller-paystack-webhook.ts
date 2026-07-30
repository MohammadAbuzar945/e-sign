import {
  OrganisationCreditPurchaseStatus,
  ResellerCreditTransactionStatus,
  ResellerPayoutMode,
  ResellerProfileStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { calculateResellerVatAmountInCents } from '@documenso/lib/utils/reseller-vat';

import {
  resolveResellerPurchaseInvoiceId,
} from '@documenso/lib/server-only/billing/record-organisation-credit-purchase';
import { sendPurchaseInvoiceEmail } from '@documenso/lib/server-only/billing/send-purchase-invoice-email';

import { associateOrganisationWithReseller, resolveResellerDisplayName } from './reseller-association';
import { markResellerCreditsBalanceChanged } from './reseller-delinquency';
import { buildNomiaHybridPurchaseReference } from './hybrid-single-checkout';
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
    creditAmount?: number | string;
    subaccountCode?: string;
    purchaseGroupId?: string;
    hybridSingleCheckout?: boolean | string;
    resellerCredits?: number | string;
    nomiaCredits?: number | string;
    resellerAmountInCents?: number | string;
    nomiaAmountInCents?: number | string;
    catalogPackageId?: string;
  };
  amountInCents: number;
  purchaserEmail: string;
  purchaserName?: string;
};

const buildTransactionRecordData = ({
  profile,
  pkg,
  credits,
  grossAmount,
  purchaserOrganisation,
  purchaserUserId,
  paystackReference,
  purchaserEmail,
  purchaserName,
  vatAmount,
  payoutMode,
  paystackSubaccountCode,
  purchaseGroupId,
  sellerVatStatus,
  sellerVatNumber,
  sellerDisplayName,
  sellerPhysicalAddress,
  sellerAffiliateSlug,
}: {
  profile: {
    id: string;
    organisationId: string;
  };
  pkg: {
    id: string;
    currency: string;
  };
  credits: number;
  grossAmount: number;
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
  purchaseGroupId?: string | null;
  sellerVatStatus?: 'NOT_REGISTERED' | 'REGISTERED' | null;
  sellerVatNumber?: string | null;
  sellerDisplayName?: string | null;
  sellerPhysicalAddress?: string | null;
  sellerAffiliateSlug?: string | null;
}) => ({
  resellerProfileId: profile.id,
  resellerOrganisationId: profile.organisationId,
  purchaserOrganisationId: purchaserOrganisation.id,
  purchaserUserId,
  packageId: pkg.id,
  paystackReference,
  credits,
  grossAmount,
  vatAmount,
  sellerVatStatus: sellerVatStatus ?? null,
  sellerVatNumber: sellerVatNumber?.trim() || null,
  sellerDisplayName: sellerDisplayName?.trim() || null,
  sellerPhysicalAddress: sellerPhysicalAddress?.trim() || null,
  sellerAffiliateSlug: sellerAffiliateSlug?.trim() || null,
  currency: pkg.currency,
  status: ResellerCreditTransactionStatus.PENDING,
  payoutMode,
  paystackSubaccountCode: paystackSubaccountCode ?? null,
  purchaserName: purchaserName ?? purchaserOrganisation.owner.name ?? purchaserEmail,
  purchaserEmail,
  purchaserOrganisationName: purchaserOrganisation.name,
  purchaseGroupId: purchaseGroupId ?? null,
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
  const metadataCreditAmount = coercePaystackMetadataNumber(metadata.creditAmount);
  const isHybridSingleCheckout =
    metadata.hybridSingleCheckout === true || metadata.hybridSingleCheckout === 'true';
  const hybridResellerCredits = coercePaystackMetadataNumber(metadata.resellerCredits);
  const hybridNomiaCredits = coercePaystackMetadataNumber(metadata.nomiaCredits);
  const hybridResellerAmountInCents = coercePaystackMetadataNumber(metadata.resellerAmountInCents);
  const hybridNomiaAmountInCents = coercePaystackMetadataNumber(metadata.nomiaAmountInCents);
  const creditAmount = metadataCreditAmount ?? pkg.creditAmount;
  const purchaserUserId =
    coercePaystackMetadataNumber(metadata.purchaserUserId) ?? purchaserOrganisation.ownerUserId;
  const resolvedPurchaserName =
    purchaserName ?? purchaserOrganisation.owner.name ?? purchaserEmail;

  let expectedGross: number;

  if (isHybridSingleCheckout) {
    if (
      !hybridResellerCredits ||
      !hybridNomiaCredits ||
      hybridResellerAmountInCents === undefined ||
      hybridNomiaAmountInCents === undefined
    ) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Missing hybrid purchase metadata',
      });
    }

    if (hybridResellerCredits + hybridNomiaCredits !== pkg.creditAmount) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Hybrid credit split does not match package size',
      });
    }

    if (creditAmount !== pkg.creditAmount) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid credit amount for hybrid reseller purchase',
      });
    }

    expectedGross = hybridResellerAmountInCents + hybridNomiaAmountInCents;
  } else {
    if (creditAmount <= 0 || creditAmount > pkg.creditAmount) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Invalid credit amount for reseller purchase',
      });
    }

    expectedGross =
      expectedAmount ??
      (creditAmount === pkg.creditAmount
        ? pkg.priceInCents
        : Math.round((pkg.priceInCents * creditAmount) / pkg.creditAmount));
  }

  if (expectedGross !== amountInCents) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Payment amount does not match expected reseller purchase amount',
    });
  }

  const resellerCreditsToTransfer = isHybridSingleCheckout ? hybridResellerCredits! : creditAmount;
  const creditsToGrant = isHybridSingleCheckout
    ? hybridResellerCredits! + hybridNomiaCredits!
    : creditAmount;
  const resellerGrossAmount = isHybridSingleCheckout ? hybridResellerAmountInCents! : amountInCents;
  const vatAmount = calculateResellerVatAmountInCents(
    resellerGrossAmount,
    profile.vatNumber,
    profile.vatStatus,
  );
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
  const purchaseGroupId =
    typeof metadata.purchaseGroupId === 'string' ? metadata.purchaseGroupId : null;
  const nomiaPurchaseReference = isHybridSingleCheckout
    ? buildNomiaHybridPurchaseReference(paystackReference)
    : null;

  const fulfillmentResult = await prisma.$transaction(async (tx) => {
    const transactionRecord =
      existingTransaction ??
      (await tx.resellerCreditTransaction.create({
        data: buildTransactionRecordData({
          profile,
          pkg,
          credits: resellerCreditsToTransfer,
          grossAmount: resellerGrossAmount,
          purchaserOrganisation,
          purchaserUserId,
          paystackReference,
          purchaserEmail,
          purchaserName: resolvedPurchaserName,
          vatAmount,
          payoutMode,
          paystackSubaccountCode,
          purchaseGroupId,
          sellerVatStatus: profile.vatStatus,
          sellerVatNumber: profile.vatNumber,
          sellerDisplayName: resolveResellerDisplayName(profile),
          sellerPhysicalAddress: profile.physicalAddress,
          sellerAffiliateSlug: profile.affiliateSlug,
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
      amount: resellerCreditsToTransfer,
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
      amount: creditsToGrant,
    });

    if (isHybridSingleCheckout && nomiaPurchaseReference && hybridNomiaCredits) {
      await tx.organisationCreditPurchase.upsert({
        where: {
          paystackReference: nomiaPurchaseReference,
        },
        create: {
          paystackReference: nomiaPurchaseReference,
          organisationId: purchaserOrganisation.id,
          userId: purchaserUserId,
          credits: hybridNomiaCredits,
          grossAmount: hybridNomiaAmountInCents!,
          currency: pkg.currency,
          purchaseGroupId,
          status: OrganisationCreditPurchaseStatus.COMPLETED,
          completedAt: new Date(),
        },
        update: {
          organisationId: purchaserOrganisation.id,
          userId: purchaserUserId,
          credits: hybridNomiaCredits,
          grossAmount: hybridNomiaAmountInCents!,
          currency: pkg.currency,
          purchaseGroupId,
          status: OrganisationCreditPurchaseStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }

    const completedTransaction = await tx.resellerCreditTransaction.update({
      where: { id: transactionRecord.id },
      data: {
        status: ResellerCreditTransactionStatus.COMPLETED,
        completedAt: new Date(),
        vatAmount,
        credits: resellerCreditsToTransfer,
        grossAmount: resellerGrossAmount,
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
      creditsRequired: resellerCreditsToTransfer,
    }).catch((error) => {
      console.error('[RESELLER]: Failed to send insufficient credits email', error);
    });
  }

  if (fulfillmentResult.fulfilled) {
    const fulfilledPurchaseGroupId = fulfillmentResult.transaction.purchaseGroupId;
    const isPartialTwoCheckoutLeg =
      Boolean(fulfilledPurchaseGroupId) &&
      !isHybridSingleCheckout &&
      fulfillmentResult.transaction.credits < pkg.creditAmount;

    // OWN_PAYSTACK hybrid: wait for the Nomia remainder before emailing so both
    // invoices go out in a single mail. Hybrid single-checkout already created both.
    if (!isPartialTwoCheckoutLeg) {
      await sendPurchaseInvoiceEmail({
        organisationId: purchaserOrganisation.id,
        purchaseGroupId: fulfilledPurchaseGroupId,
        invoiceId: resolveResellerPurchaseInvoiceId({
          transactionId: fulfillmentResult.transaction.id,
          purchaseGroupId: fulfilledPurchaseGroupId,
        }),
        recipientEmail: purchaserEmail,
        recipientName: resolvedPurchaserName,
      }).catch((error) => {
        console.error('[RESELLER]: Failed to send purchase invoice email', error);
      });
    }
  }

  // Sticky attribution on purchase (§8.2) + delinquency balance sync (§12).
  await associateOrganisationWithReseller({
    organisationId: purchaserOrganisation.id,
    resellerProfileId: profile.id,
    source: 'AFFILIATE_PURCHASE',
  }).catch((error) => {
    console.error('[RESELLER]: Failed to associate purchaser organisation', error);
  });

  await markResellerCreditsBalanceChanged(profile.organisationId).catch((error) => {
    console.error('[RESELLER]: Failed to sync delinquency state', error);
  });

  return {
    handled: true as const,
    fulfilled: fulfillmentResult.fulfilled,
    awaitingManualTransfer: !fulfillmentResult.fulfilled,
    transaction: fulfillmentResult.transaction,
  };
};
