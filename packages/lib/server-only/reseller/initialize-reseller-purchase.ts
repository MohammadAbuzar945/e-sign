import { ResellerPayoutMode, ResellerProfileStatus } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resolveResellerPackageCommercials } from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { getPaystackClientErrorMessage } from '@documenso/lib/server-only/paystack/paystack-error';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import {
  buildHybridPaystackSplit,
  buildHybridTransactionCharge,
  type HybridCheckoutAmounts,
} from './hybrid-single-checkout';
import { getResellerPayoutReadiness } from './reseller-payout-readiness';
import { decryptResellerSecret } from './reseller-secrets';

export type HybridSingleCheckoutSplit = HybridCheckoutAmounts & {
  catalogPackageId?: string;
};

export type InitializeResellerPurchaseOptions = {
  affiliateSlug: string;
  packageId: string;
  purchaserOrganisationId: string;
  purchaserUserId: number;
  purchaserEmail: string;
  /**
   * Partial fulfillment (agreement §10.3). Must be <= package credits and available stock.
   */
  creditAmountOverride?: number;
  amountInCentsOverride?: number;
  /**
   * Single Paystack checkout for hybrid partial-stock (NOMIA_SUBACCOUNT only).
   */
  hybridSingleCheckoutSplit?: HybridSingleCheckoutSplit;
  callbackPath?: string;
  purchaseGroupId?: string;
};

export const initializeResellerPurchase = async ({
  affiliateSlug,
  packageId,
  purchaserOrganisationId,
  purchaserUserId,
  purchaserEmail,
  creditAmountOverride,
  amountInCentsOverride,
  hybridSingleCheckoutSplit,
  callbackPath,
  purchaseGroupId: purchaseGroupIdInput,
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

  const payoutReadiness = getResellerPayoutReadiness(profile);

  if (!payoutReadiness.canAcceptPayments) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message:
        payoutReadiness.blockingReason ??
        'This reseller is not ready to accept payments right now',
    });
  }

  const availableCredits = await getOrganisationCredits(profile.organisationId);
  const commercials = await resolveResellerPackageCommercials(pkg);

  if (!commercials) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This package is no longer available for purchase',
    });
  }

  const isHybridSingleCheckout =
    Boolean(hybridSingleCheckoutSplit) &&
    profile.payoutMode === ResellerPayoutMode.NOMIA_SUBACCOUNT;

  const creditAmount = isHybridSingleCheckout
    ? hybridSingleCheckoutSplit!.totalCredits
    : (creditAmountOverride ?? commercials.creditAmount);
  const amountInCents = isHybridSingleCheckout
    ? hybridSingleCheckoutSplit!.totalAmountInCents
    : (amountInCentsOverride ??
      (creditAmount === commercials.creditAmount
        ? commercials.priceInCents
        : Math.round((commercials.priceInCents * creditAmount) / commercials.creditAmount)));
  const resellerCreditsToTransfer = isHybridSingleCheckout
    ? hybridSingleCheckoutSplit!.resellerCredits
    : creditAmount;

  if (creditAmount <= 0 || creditAmount > commercials.creditAmount) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid credit amount for this package',
    });
  }

  if (!Number.isFinite(amountInCents) || amountInCents < 100) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid package price for checkout',
    });
  }

  if (isHybridSingleCheckout && hybridSingleCheckoutSplit!.totalCredits !== commercials.creditAmount) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Hybrid checkout must cover the full package credit amount',
    });
  }

  if (!profile.allowNegativeCredits && availableCredits < resellerCreditsToTransfer) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller does not have enough credits to fulfill this purchase right now',
    });
  }

  const callbackUrl = `${NEXT_PUBLIC_WEBAPP_URL()}${
    callbackPath ?? `/r/${affiliateSlug}?purchase=success`
  }`;
  const purchaseGroupId = purchaseGroupIdInput ?? prefixedId('pur');

  const metadata = {
    type: 'reseller-credit-purchase',
    payoutMode: profile.payoutMode,
    resellerProfileId: profile.id,
    purchaserOrganisationId,
    purchaserUserId,
    packageId: pkg.id,
    expectedAmount: amountInCents,
    creditAmount,
    purchaseGroupId,
    ...(isHybridSingleCheckout
      ? {
          hybridSingleCheckout: true,
          resellerCredits: hybridSingleCheckoutSplit!.resellerCredits,
          nomiaCredits: hybridSingleCheckoutSplit!.nomiaCredits,
          resellerAmountInCents: hybridSingleCheckoutSplit!.resellerAmountInCents,
          nomiaAmountInCents: hybridSingleCheckoutSplit!.nomiaAmountInCents,
          ...(hybridSingleCheckoutSplit!.catalogPackageId
            ? { catalogPackageId: hybridSingleCheckoutSplit!.catalogPackageId }
            : {}),
        }
      : {}),
    ...(profile.payoutMode === ResellerPayoutMode.NOMIA_SUBACCOUNT && profile.paystackSubaccountCode
      ? { subaccountCode: profile.paystackSubaccountCode }
      : {}),
  };

  let transaction;

  const initializePaystackCheckout = async (
    options: Parameters<typeof createTransaction>[0],
  ) => {
    try {
      return await createTransaction({
        ...options,
        currency: options.currency ?? commercials.currency ?? 'ZAR',
      });
    } catch (error) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: getPaystackClientErrorMessage(error),
      });
    }
  };

  if (profile.payoutMode === ResellerPayoutMode.OWN_PAYSTACK) {
    if (!profile.paystackSecretKey) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Reseller Paystack secret key is not configured',
      });
    }

    transaction = await initializePaystackCheckout({
      email: purchaserEmail,
      amount: amountInCents,
      callback_url: callbackUrl,
      metadata,
      secretKey: decryptResellerSecret(profile.paystackSecretKey),
    });
  } else {
    if (!profile.paystackSubaccountCode) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Reseller payout subaccount is not configured',
      });
    }

    const platformFeePercent = Number(profile.platformFeePercent ?? 0);
    const transactionCharge = isHybridSingleCheckout
      ? buildHybridTransactionCharge({
          nomiaAmountInCents: hybridSingleCheckoutSplit!.nomiaAmountInCents,
          resellerAmountInCents: hybridSingleCheckoutSplit!.resellerAmountInCents,
          platformFeePercent,
        })
      : platformFeePercent > 0
        ? Math.round((amountInCents * platformFeePercent) / 100)
        : 0;

    if (transactionCharge >= amountInCents) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Payment split is invalid for this package amount',
      });
    }

    const resellerShareInCents = amountInCents - transactionCharge;

    if (resellerShareInCents <= 0) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Payment split is invalid for this package amount',
      });
    }

    transaction = await initializePaystackCheckout({
      email: purchaserEmail,
      amount: amountInCents,
      callback_url: callbackUrl,
      metadata,
      ...(isHybridSingleCheckout
        ? {
            // Both Nomia and the reseller bear Paystack fees (`bearer_type: all`).
            split: buildHybridPaystackSplit({
              subaccountCode: profile.paystackSubaccountCode,
              amountInCents,
              transactionCharge,
            }),
          }
        : {
            subaccount: profile.paystackSubaccountCode,
            bearer: 'subaccount',
            ...(transactionCharge > 0 ? { transaction_charge: transactionCharge } : {}),
          }),
    });
  }

  if (!transaction.status || !transaction.data) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: transaction.message || 'Failed to initialize Paystack transaction',
    });
  }

  return {
    authorizationUrl: transaction.data.authorization_url,
    reference: transaction.data.reference,
    package: pkg,
    payoutMode: profile.payoutMode,
    purchaseGroupId,
  };
};
