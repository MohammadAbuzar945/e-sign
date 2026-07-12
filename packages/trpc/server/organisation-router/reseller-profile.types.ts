import { z } from 'zod';

import { ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZGetResellerProfileRequestSchema = z.object({
  organisationId: z.string(),
});

const ZResellerPackageSchema = z.object({
  id: z.string(),
  catalogPackageId: z.string(),
  creditAmount: z.number(),
  priceInCents: z.number(),
  currency: z.string(),
  isEnabled: z.boolean(),
  paystackPlanCode: z.string().nullable(),
  paystackPaymentUrl: z.string().nullable(),
});

export const ZGetResellerProfileResponseSchema = z
  .object({
    id: z.string(),
    organisationId: z.string(),
    status: z.string(),
    affiliateSlug: z.string(),
    affiliateUrl: z.string(),
    availableCredits: z.number(),
    hasPaystackConfigured: z.boolean(),
    paystackPublicKey: z.string().nullable(),
    paystackWebhookUrl: z.string(),
    vatNumber: z.string().nullable(),
    allowNegativeCredits: z.boolean(),
    instructionsDismissedAt: z.date().nullable(),
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
    packages: z.array(ZResellerPackageSchema),
    catalogPackages: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        credits: z.number(),
        priceInCents: z.number(),
        currency: z.string(),
        displayPrice: z.string(),
        category: z.string(),
      }),
    ),
    organisation: z.object({
      id: z.string(),
      name: z.string(),
      url: z.string(),
    }),
  })
  .nullable();

export const ZUpdateResellerProfileRequestSchema = z.object({
  organisationId: z.string(),
  data: z.object({
    paystackPublicKey: z.string().optional(),
    paystackSecretKey: z.string().optional(),
    vatNumber: z.string().optional(),
    instructionsDismissed: z.boolean().optional(),
    brandingEnabled: z.boolean().optional(),
    brandingLogo: z.string().nullable().optional(),
    brandingUrl: z.string().nullable().optional(),
    brandingCompanyDetails: z.string().nullable().optional(),
    brandingPrimaryColor: z.string().nullable().optional(),
    affiliatePageTitle: z.string().nullable().optional(),
    affiliatePageDescription: z.string().nullable().optional(),
    affiliateAboutText: z.string().nullable().optional(),
    affiliateSupportEmail: z.union([z.string().email(), z.literal('')]).nullish(),
    highlightedCatalogPackageId: z.string().nullable().optional(),
  }),
});

export const ZUpdateResellerProfileResponseSchema = z.object({
  success: z.literal(true),
});

export const ZUpdateResellerPackagesRequestSchema = z.object({
  organisationId: z.string(),
  enabledCatalogPackageIds: z.array(z.string()),
});

export const ZUpdateResellerPackagesResponseSchema = ZGetResellerProfileResponseSchema;

export const ZFindResellerTransactionsRequestSchema = ZFindSearchParamsSchema.extend({
  organisationId: z.string(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const ZFindResellerTransactionsResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      createdAt: z.date(),
      completedAt: z.date().nullable(),
      credits: z.number(),
      grossAmount: z.number(),
      vatAmount: z.number(),
      currency: z.string(),
      status: z.string(),
      purchaserName: z.string(),
      purchaserEmail: z.string(),
      purchaserOrganisationName: z.string(),
      paystackReference: z.string().nullable(),
    }),
  ),
  count: z.number(),
  currentPage: z.number(),
  perPage: z.number(),
  totalPages: z.number(),
});
