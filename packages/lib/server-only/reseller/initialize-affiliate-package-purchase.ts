import { ResellerPayoutMode } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createPendingOrganisationCreditPurchase } from '@documenso/lib/server-only/billing/record-organisation-credit-purchase';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { associateOrganisationWithReseller } from './reseller-association';
import { calculateHybridCheckoutAmounts } from './hybrid-single-checkout';
import { initializeResellerPurchase } from './initialize-reseller-purchase';
import { getResellerPayoutReadiness } from './reseller-payout-readiness';

export type InitializeAffiliatePackagePurchaseOptions = {
  affiliateSlug: string;
  packageId: string;
  purchaserOrganisationId: string;
  purchaserUserId: number;
  purchaserEmail: string;
};

export const initializeAffiliatePackagePurchase = async ({
  affiliateSlug,
  packageId,
  purchaserOrganisationId,
  purchaserUserId,
  purchaserEmail,
}: InitializeAffiliatePackagePurchaseOptions) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { affiliateSlug },
    include: {
      packages: true,
      organisation: { select: { id: true } },
    },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller not found',
    });
  }

  const pkg = profile.packages.find((item) => item.id === packageId && item.isEnabled);

  if (!pkg) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Package is not available for purchase',
    });
  }

  await associateOrganisationWithReseller({
    organisationId: purchaserOrganisationId,
    resellerProfileId: profile.id,
    source: 'AFFILIATE_PURCHASE',
  }).catch(() => {
    // Association is best-effort; purchase can still proceed.
  });

  // Purchases initiated from the affiliate page must always return to the affiliate page,
  // regardless of whether the reseller can fulfill from stock or Nomia handles it.
  const affiliateCallbackPath = `/r/${affiliateSlug}?purchase=success`;

  const purchaseGroupId = prefixedId('pur');
  const availableCredits = await getOrganisationCredits(profile.organisationId);
  const payoutReadiness = getResellerPayoutReadiness(profile);
  const canAcceptPayments = payoutReadiness.canAcceptPayments;
  const hasFullStock =
    canAcceptPayments &&
    (profile.allowNegativeCredits || availableCredits >= pkg.creditAmount);
  const hasPartialStock =
    canAcceptPayments &&
    !profile.allowNegativeCredits &&
    availableCredits > 0 &&
    availableCredits < pkg.creditAmount;

  if (hasFullStock) {
    const result = await initializeResellerPurchase({
      affiliateSlug,
      packageId,
      purchaserOrganisationId,
      purchaserUserId,
      purchaserEmail,
      callbackPath: affiliateCallbackPath,
      purchaseGroupId,
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  }

  if (hasPartialStock) {
    const hybridAmounts = calculateHybridCheckoutAmounts({
      packageCreditAmount: pkg.creditAmount,
      packagePriceInCents: pkg.priceInCents,
      resellerCredits: availableCredits,
    });
    const isNomiaSubaccount = profile.payoutMode === ResellerPayoutMode.NOMIA_SUBACCOUNT;

    const result = await initializeResellerPurchase({
      affiliateSlug,
      packageId,
      purchaserOrganisationId,
      purchaserUserId,
      purchaserEmail,
      purchaseGroupId,
      ...(isNomiaSubaccount
        ? {
            hybridSingleCheckoutSplit: {
              ...hybridAmounts,
              catalogPackageId: pkg.catalogPackageId,
            },
            callbackPath: affiliateCallbackPath,
          }
        : {
            creditAmountOverride: hybridAmounts.resellerCredits,
            amountInCentsOverride: hybridAmounts.resellerAmountInCents,
            callbackPath: `${affiliateCallbackPath}&hybrid=nomia&catalogPackageId=${pkg.catalogPackageId}&nomiaCredits=${hybridAmounts.nomiaCredits}&nomiaAmount=${hybridAmounts.nomiaAmountInCents}&purchaseGroupId=${purchaseGroupId}`,
          }),
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  }

  const catalog = ESIGN_CREDIT_PACKAGES.find((item) => item.id === pkg.catalogPackageId);

  if (!catalog) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This package is not available for purchase right now',
    });
  }

  const transaction = await createTransaction({
    email: purchaserEmail,
    amount: catalog.priceInCents,
    callback_url: `${NEXT_PUBLIC_WEBAPP_URL()}${affiliateCallbackPath}`,
    metadata: {
      value: catalog.credits,
      organisationId: purchaserOrganisationId,
      type: 'organisation-credit-purchase',
      catalogPackageId: pkg.catalogPackageId,
      affiliateSlug,
      purchaseGroupId,
    },
  });

  if (!transaction.status || !transaction.data) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: transaction.message || 'Failed to initialize Paystack transaction',
    });
  }

  await createPendingOrganisationCreditPurchase({
    organisationId: purchaserOrganisationId,
    userId: purchaserUserId,
    paystackReference: transaction.data.reference,
    credits: catalog.credits,
    grossAmount: catalog.priceInCents,
    currency: catalog.currency,
    purchaseGroupId,
  }).catch(() => {
    // Pending row is best-effort; webhook still grants credits from metadata.
  });

  return {
    authorizationUrl: transaction.data.authorization_url,
    reference: transaction.data.reference,
  };
};
