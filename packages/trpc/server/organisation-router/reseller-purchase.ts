import { ESIGN_CREDIT_PACKAGES } from '@documenso/lib/constants/esign-credit-packages';
import { RESELLER_BILLING_DISCLOSURE_PREFIX } from '@documenso/lib/constants/reseller-attribution';
import { initializeResellerPurchase } from '@documenso/lib/server-only/reseller/initialize-reseller-purchase';
import { associateOrganisationWithReseller, resolveResellerDisplayName } from '@documenso/lib/server-only/reseller/reseller-association';
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

    const packages = profile.packages.map((pkg) => {
      const catalog = ESIGN_CREDIT_PACKAGES.find((item) => item.id === pkg.catalogPackageId);
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
    });

    return {
      affiliateSlug: profile.affiliateSlug,
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
    const { affiliateSlug, packageId, organisationId, creditAmountOverride, amountInCentsOverride } =
      input;

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: ctx.user.id },
    });

    const profile = await prisma.resellerProfile.findUnique({
      where: { affiliateSlug },
      select: { id: true },
    });

    if (profile) {
      await associateOrganisationWithReseller({
        organisationId,
        resellerProfileId: profile.id,
        source: 'AFFILIATE_PURCHASE',
      }).catch(() => {
        // Association is best-effort; purchase can still proceed.
      });
    }

    const organisation = await prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
      select: { url: true },
    });

    const isPartial = Boolean(creditAmountOverride);
    const pkg = await prisma.resellerPackage.findUnique({
      where: { id: packageId },
      select: { catalogPackageId: true, creditAmount: true, priceInCents: true },
    });

    let callbackPath: string | undefined;

    if (isPartial && pkg && creditAmountOverride) {
      const nomiaCredits = Math.max(0, pkg.creditAmount - creditAmountOverride);
      const nomiaAmountInCents = Math.max(
        0,
        pkg.priceInCents - (amountInCentsOverride ?? 0),
      );

      callbackPath = `/o/${organisation.url}/price-plan?hybrid=nomia&catalogPackageId=${pkg.catalogPackageId}&nomiaCredits=${nomiaCredits}&nomiaAmount=${nomiaAmountInCents}&purchase=reseller-partial`;
    }

    const result = await initializeResellerPurchase({
      affiliateSlug,
      packageId,
      purchaserOrganisationId: organisationId,
      purchaserUserId: ctx.user.id,
      purchaserEmail: user.email,
      creditAmountOverride,
      amountInCentsOverride,
      callbackPath,
    });

    return {
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    };
  });
