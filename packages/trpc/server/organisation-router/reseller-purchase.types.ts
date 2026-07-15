import { z } from 'zod';

export const ZInitializeResellerPurchaseRequestSchema = z.object({
  affiliateSlug: z.string(),
  packageId: z.string(),
  organisationId: z.string(),
  creditAmountOverride: z.number().int().positive().optional(),
  amountInCentsOverride: z.number().int().positive().optional(),
});

export const ZInitializeResellerPurchaseResponseSchema = z.object({
  authorizationUrl: z.string(),
  reference: z.string(),
});

export const ZGetAffiliateResellerRequestSchema = z.object({
  affiliateSlug: z.string(),
});

export const ZGetAffiliateResellerResponseSchema = z
  .object({
    affiliateSlug: z.string(),
    organisationName: z.string(),
    resellerDisplayName: z.string(),
    disclosure: z.string(),
    availableCredits: z.number(),
    allowNegativeCredits: z.boolean(),
    payoutMode: z.enum(['OWN_PAYSTACK', 'NOMIA_SUBACCOUNT']),
    canAcceptPayments: z.boolean(),
    payoutBlockingReason: z.string().nullable(),
    hasPackages: z.boolean(),
    brandingEnabled: z.boolean(),
    brandingLogo: z.string().nullable(),
    brandingUrl: z.string().nullable(),
    brandingCompanyDetails: z.string().nullable(),
    brandingPrimaryColor: z.string().nullable(),
    affiliatePageTitle: z.string().nullable(),
    affiliatePageDescription: z.string().nullable(),
    affiliateAboutText: z.string().nullable(),
    affiliateSupportEmail: z.string().nullable(),
    highlightedCatalogPackageId: z.string().nullable(),
    vatNumber: z.string().nullable(),
    isDelinquent: z.boolean(),
    packages: z.array(
      z.object({
        id: z.string(),
        catalogPackageId: z.string(),
        creditAmount: z.number(),
        priceInCents: z.number(),
        currency: z.string(),
        displayPrice: z.string(),
        name: z.string(),
        isHighlighted: z.boolean(),
        canPurchase: z.boolean(),
        canPartialFulfill: z.boolean(),
        availableResellerCredits: z.number(),
      }),
    ),
  })
  .nullable();
