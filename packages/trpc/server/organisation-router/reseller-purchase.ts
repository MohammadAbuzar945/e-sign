import { assertResellerCheckoutAccess } from '@documenso/lib/constants/demo-feature-flags';
import { RESELLER_BILLING_DISCLOSURE_PREFIX } from '@documenso/lib/constants/reseller-attribution';
import { getEsignCreditPackageByIdFromCatalog } from '@documenso/lib/server-only/billing/nomia-price-catalog';
import { initializeAffiliatePackagePurchase } from '@documenso/lib/server-only/reseller/initialize-affiliate-package-purchase';
import { resolveResellerDisplayName } from '@documenso/lib/server-only/reseller/reseller-association';
import { getResellerProfileByAffiliateSlug } from '@documenso/lib/server-only/reseller/reseller-profile';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure, procedure } from '../trpc';
import {
  ZGetAffiliateResellerRequestSchema,
  ZGetAffiliateResellerResponseSchema,
  ZInitializeResellerPurchaseRequestSchema,
  ZInitializeResellerPurchaseResponseSchema,
} from './reseller-purchase.types';

export const getAffiliateResellerRoute = procedure
  .input(ZGetAffiliateResellerRequestSchema)
  .output(ZGetAffiliateResellerResponseSchema)
  .query(async ({ input }) => {
    const profile = await getResellerProfileByAffiliateSlug(input.affiliateSlug);

    if (!profile) {
      return null;
    }

    const displayName = resolveResellerDisplayName({
      organisation: { name: profile.organisation.name },
      brandingCompanyDetails: profile.brandingCompanyDetails,
    });

    const packages = await Promise.all(
      profile.packages.map(async (pkg) => {
        const catalog = await getEsignCreditPackageByIdFromCatalog(pkg.catalogPackageId);
        const hasEnoughCredits =
          profile.allowNegativeCredits || profile.availableCredits >= pkg.creditAmount;
        const canPurchase = profile.canAcceptAffiliatePayments && hasEnoughCredits;
        const canPartialFulfill =
          profile.canAcceptAffiliatePayments &&
          !profile.allowNegativeCredits &&
          profile.availableCredits > 0 &&
          profile.availableCredits < pkg.creditAmount;

        return {
          id: pkg.id,
          catalogPackageId: pkg.catalogPackageId,
          creditAmount: pkg.creditAmount,
          priceInCents: pkg.priceInCents,
          currency: pkg.currency,
          displayPrice:
            catalog?.displayPrice ?? `${pkg.currency} ${(pkg.priceInCents / 100).toFixed(2)}`,
          name: catalog?.name ?? `${pkg.creditAmount} envelopes`,
          isHighlighted: profile.highlightedCatalogPackageId === pkg.catalogPackageId,
          canPurchase,
          canPartialFulfill,
          availableResellerCredits: profile.availableCredits,
        };
      }),
    );

    return {
      affiliateSlug: profile.affiliateSlug,
      organisationId: profile.organisationId,
      organisationName: profile.organisation.name,
      resellerDisplayName: displayName,
      disclosure: `${RESELLER_BILLING_DISCLOSURE_PREFIX} ${displayName}`,
      availableCredits: profile.availableCredits,
      allowNegativeCredits: profile.allowNegativeCredits,
      payoutMode: profile.payoutMode,
      canAcceptPayments: profile.canAcceptAffiliatePayments,
      payoutBlockingReason: profile.payoutBlockingReason,
      hasPackages: packages.length > 0,
      brandingEnabled: profile.brandingEnabled,
      brandingLogo: profile.brandingLogo,
      brandingUrl: profile.brandingUrl,
      brandingCompanyDetails: profile.brandingCompanyDetails,
      brandingPrimaryColor: profile.brandingPrimaryColor,
      affiliatePageTitle: profile.affiliatePageTitle,
      affiliatePageDescription: profile.affiliatePageDescription,
      affiliateAboutText: profile.affiliateAboutText,
      affiliateSupportEmail: profile.affiliateSupportEmail,
      highlightedCatalogPackageId: profile.highlightedCatalogPackageId,
      vatNumber: profile.vatNumber,
      isDelinquent: profile.isDelinquent ?? false,
      packages,
    };
  });

export const initializeResellerPurchaseRoute = authenticatedProcedure
  .input(ZInitializeResellerPurchaseRequestSchema)
  .output(ZInitializeResellerPurchaseResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerCheckoutAccess(ctx.user.email);

    const { affiliateSlug, packageId, organisationId } = input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
    });

    return initializeAffiliatePackagePurchase({
      affiliateSlug,
      packageId,
      purchaserOrganisationId: organisationId,
      purchaserUserId: ctx.user.id,
      purchaserEmail: user.email,
    });
  });
