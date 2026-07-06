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
    packages: z.array(
      z.object({
        id: z.string(),
        catalogPackageId: z.string(),
        creditAmount: z.number(),
        priceInCents: z.number(),
        currency: z.string(),
        displayPrice: z.string(),
        name: z.string(),
      }),
    ),
  })
  .nullable();
