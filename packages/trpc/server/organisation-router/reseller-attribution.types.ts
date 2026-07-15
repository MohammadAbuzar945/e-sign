import { z } from 'zod';

export const ZGetOrganisationBillingAttributionRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZGetOrganisationBillingAttributionResponseSchema = z
  .object({
    hasAssociation: z.boolean(),
    requiresReconsent: z.boolean(),
    associatedAt: z.date().nullable(),
    associationSource: z
      .enum(['AFFILIATE_VISIT', 'AFFILIATE_SIGNUP', 'AFFILIATE_PURCHASE', 'CUSTOMER_CONSENT'])
      .nullable(),
    stickyBillingActive: z.boolean(),
    availableCredits: z.number(),
    canAcceptPayments: z.boolean(),
    payoutBlockingReason: z.string().nullable(),
    resellerDisplayName: z.string().nullable(),
    affiliateSlug: z.string().nullable(),
    resellerProfileId: z.string().nullable(),
    disclosure: z.string().nullable(),
    isDelinquent: z.boolean(),
    packages: z.array(
      z.object({
        id: z.string(),
        catalogPackageId: z.string(),
        creditAmount: z.number(),
        priceInCents: z.number(),
        currency: z.string(),
        name: z.string(),
        displayPrice: z.string(),
        canFulfillFromReseller: z.boolean(),
        billingSource: z.enum(['RESELLER', 'NOMIA', 'HYBRID']),
      }),
    ),
  })
  .nullable();

export const ZResolvePaygBillingRequestSchema = z.object({
  organisationId: z.string(),
  catalogPackageId: z.string(),
});

export const ZResolvePaygBillingResponseSchema = z.object({
  source: z.enum(['RESELLER', 'NOMIA', 'HYBRID']),
  reason: z.string(),
  disclosure: z.string().nullable(),
  resellerDisplayName: z.string().nullable(),
  affiliateSlug: z.string().nullable(),
  resellerProfileId: z.string().nullable(),
  resellerPackage: z
    .object({
      id: z.string(),
      catalogPackageId: z.string(),
      creditAmount: z.number(),
      priceInCents: z.number(),
      currency: z.string(),
      displayPrice: z.string(),
      name: z.string(),
    })
    .nullable(),
  split: z
    .object({
      resellerCredits: z.number(),
      resellerAmountInCents: z.number(),
      nomiaCredits: z.number(),
      nomiaAmountInCents: z.number(),
      resellerPackageId: z.string(),
      catalogPackageId: z.string(),
    })
    .nullable(),
});

export const ZAssociateResellerRequestSchema = z.object({
  organisationId: z.string(),
  affiliateSlug: z.string(),
  source: z.enum(['AFFILIATE_VISIT', 'AFFILIATE_SIGNUP', 'CUSTOMER_CONSENT']),
  customerConsent: z.boolean().optional(),
});

export const ZAssociateResellerResponseSchema = z.object({
  associated: z.boolean(),
  reason: z.string(),
  requiresReconsent: z.boolean().optional(),
});

export const ZInitializeAttributedPaygRequestSchema = z.object({
  organisationId: z.string(),
  catalogPackageId: z.string(),
  /** When hybrid: which step to initialize. */
  hybridStep: z.enum(['RESELLER', 'NOMIA']).optional(),
  /** Required for hybrid Nomia remainder after reseller partial payment. */
  nomiaCreditsOverride: z.number().int().positive().optional(),
  nomiaAmountInCentsOverride: z.number().int().positive().optional(),
});

export const ZInitializeAttributedPaygResponseSchema = z.object({
  source: z.enum(['RESELLER', 'NOMIA', 'HYBRID']),
  disclosure: z.string().nullable(),
  resellerDisplayName: z.string().nullable(),
  authorizationUrl: z.string().nullable(),
  reference: z.string().nullable(),
  /** Present when source is HYBRID and reseller step was initialized. */
  nextNomiaStep: z
    .object({
      credits: z.number(),
      amountInCents: z.number(),
      catalogPackageId: z.string(),
    })
    .nullable(),
  split: z
    .object({
      resellerCredits: z.number(),
      resellerAmountInCents: z.number(),
      nomiaCredits: z.number(),
      nomiaAmountInCents: z.number(),
    })
    .nullable(),
  reason: z.string(),
});
