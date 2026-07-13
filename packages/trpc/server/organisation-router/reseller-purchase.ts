import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import { initializeResellerPurchase } from '@documenso/lib/server-only/reseller/initialize-reseller-purchase';
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

    const packages = profile.packages.map((pkg) => {
      const catalog = ESIGN_CREDIT_PACKAGES.find((item) => item.id === pkg.catalogPackageId);
      const canPurchase =
        profile.allowNegativeCredits || profile.availableCredits >= pkg.creditAmount;

      return {
        id: pkg.id,
        catalogPackageId: pkg.catalogPackageId,
        creditAmount: pkg.creditAmount,
        priceInCents: pkg.priceInCents,
        currency: pkg.currency,
        displayPrice: catalog?.displayPrice ?? `${pkg.currency} ${(pkg.priceInCents / 100).toFixed(2)}`,
        name: catalog?.name ?? `${pkg.creditAmount} envelopes`,
        isHighlighted: profile.highlightedCatalogPackageId === pkg.catalogPackageId,
        canPurchase,
      };
    });

    return {
      affiliateSlug: profile.affiliateSlug,
      organisationName: profile.organisation.name,
      availableCredits: profile.availableCredits,
      allowNegativeCredits: profile.allowNegativeCredits,
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
      packages,
    };
  });

export const initializeResellerPurchaseRoute = authenticatedProcedure
  .input(ZInitializeResellerPurchaseRequestSchema)
  .output(ZInitializeResellerPurchaseResponseSchema)
  .mutation(async ({ input, ctx }) => {
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

    const result = await initializeResellerPurchase({
      affiliateSlug,
      packageId,
      purchaserOrganisationId: organisationId,
      purchaserUserId: ctx.user.id,
      purchaserEmail: user.email,
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  });
