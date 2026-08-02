import { ResellerPayoutMode } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createPendingOrganisationCreditPurchase } from '@documenso/lib/server-only/billing/record-organisation-credit-purchase';
import {
  getEsignCreditPackageByIdFromCatalog,
  resolveResellerPackageCommercials,
} from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { isPaystackSubaccountMissingError } from '@documenso/lib/server-only/paystack/paystack-error';
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

const initializeNomiaDirectCheckout = async ({
  affiliateSlug,
  catalogPackageId,
  purchaserOrganisationId,
  purchaserUserId,
  purchaserEmail,
  affiliateCallbackPath,
  purchaseGroupId,
  creditAmount,
  priceInCents,
  currency,
}: {
  affiliateSlug: string;
  catalogPackageId: string;
  purchaserOrganisationId: string;
  purchaserUserId: number;
  purchaserEmail: string;
  affiliateCallbackPath: string;
  purchaseGroupId: string;
  creditAmount: number;
  priceInCents: number;
  currency: string;
}) => {
  const catalog = await getEsignCreditPackageByIdFromCatalog(catalogPackageId);

  if (!catalog) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This package is not available for purchase right now',
    });
  }

  const transaction = await createTransaction({
    email: purchaserEmail,
    amount: priceInCents,
    currency,
    callback_url: `${NEXT_PUBLIC_WEBAPP_URL()}${affiliateCallbackPath}`,
    metadata: {
      value: creditAmount,
      organisationId: purchaserOrganisationId,
      type: 'organisation-credit-purchase',
      catalogPackageId,
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
    credits: creditAmount,
    grossAmount: priceInCents,
    currency,
    purchaseGroupId,
  }).catch(() => {
    // Pending row is best-effort; webhook still grants credits from metadata.
  });

  return {
    authorizationUrl: transaction.data.authorization_url,
    reference: transaction.data.reference,
  };
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
  const purchaserOrganisation = await prisma.organisation.findUnique({
    where: { id: purchaserOrganisationId },
    select: { url: true },
  });

  const affiliateCallbackPath = purchaserOrganisation?.url
    ? `/r/${affiliateSlug}?purchase=success&orgUrl=${encodeURIComponent(purchaserOrganisation.url)}`
    : `/r/${affiliateSlug}?purchase=success`;

  const commercials = await resolveResellerPackageCommercials(pkg);

  if (!commercials) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This package is no longer available for purchase',
    });
  }

  const purchaseGroupId = prefixedId('pur');
  const availableCredits = await getOrganisationCredits(profile.organisationId);
  const payoutReadiness = getResellerPayoutReadiness(profile);
  const canAcceptPayments = payoutReadiness.canAcceptPayments;
  const hasFullStock =
    canAcceptPayments &&
    (profile.allowNegativeCredits || availableCredits >= commercials.creditAmount);
  const hasPartialStock =
    canAcceptPayments &&
    !profile.allowNegativeCredits &&
    availableCredits > 0 &&
    availableCredits < commercials.creditAmount;

  const nomiaDirectCheckout = () =>
    initializeNomiaDirectCheckout({
      affiliateSlug,
      catalogPackageId: pkg.catalogPackageId,
      purchaserOrganisationId,
      purchaserUserId,
      purchaserEmail,
      affiliateCallbackPath,
      purchaseGroupId,
      creditAmount: commercials.creditAmount,
      priceInCents: commercials.priceInCents,
      currency: commercials.currency,
    });

  if (hasFullStock) {
    try {
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
    } catch (error) {
      // Subaccount missing / wrong Paystack mode → fulfill via Nomia instead of blocking the buyer.
      if (!isPaystackSubaccountMissingError(error)) {
        throw error;
      }
    }
  }

  if (hasPartialStock) {
    try {
      const hybridAmounts = calculateHybridCheckoutAmounts({
        packageCreditAmount: commercials.creditAmount,
        packagePriceInCents: commercials.priceInCents,
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
    } catch (error) {
      if (!isPaystackSubaccountMissingError(error)) {
        throw error;
      }
    }
  }

  return nomiaDirectCheckout();
};
