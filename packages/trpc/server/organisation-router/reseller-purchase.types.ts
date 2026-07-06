import { z } from 'zod';

export const ZInitializeResellerPurchaseRequestSchema = z.object({
  affiliateSlug: z.string(),
  packageId: z.string(),
  organisationId: z.string(),
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
    availableCredits: z.number(),
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
      }),
    ),
  })
  .nullable();
