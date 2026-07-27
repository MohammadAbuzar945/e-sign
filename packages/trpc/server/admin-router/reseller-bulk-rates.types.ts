import { z } from 'zod';

import { MAX_RESELLER_BULK_RATE_TIERS } from '@documenso/lib/constants/reseller-bulk-rates';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZOrganisationCreditPurchaseStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'ACTIVE',
  'INACTIVE',
  'PAST_DUE',
]);

export const ZAdminPurchaseInvoiceKindSchema = z.enum([
  'BULK',
  'PAYG',
  'RESELLER',
  'SUBSCRIPTION',
  'ALL',
]);

export const ZResellerBulkRateTierSchema = z.object({
  minCredits: z.number().int().positive(),
  pricePerCreditCents: z.number().int().positive(),
  isEnabled: z.boolean().optional().default(true),
});

export const ZListGlobalResellerBulkRatesResponseSchema = z.object({
  tiers: z.array(
    z.object({
      id: z.string(),
      minCredits: z.number(),
      pricePerCreditCents: z.number(),
      isEnabled: z.boolean(),
    }),
  ),
});

export const ZReplaceGlobalResellerBulkRatesRequestSchema = z.object({
  tiers: z.array(ZResellerBulkRateTierSchema).min(1).max(MAX_RESELLER_BULK_RATE_TIERS),
});

export const ZReplaceGlobalResellerBulkRatesResponseSchema =
  ZListGlobalResellerBulkRatesResponseSchema;

export const ZGetResellerBulkRatesRequestSchema = z.object({
  resellerProfileId: z.string(),
});

export const ZGetResellerBulkRatesResponseSchema = z.object({
  bulkRatesUseCustom: z.boolean(),
  tiers: z.array(
    z.object({
      id: z.string(),
      minCredits: z.number(),
      pricePerCreditCents: z.number(),
      isEnabled: z.boolean(),
    }),
  ),
});

export const ZReplaceResellerBulkRatesRequestSchema = z.object({
  resellerProfileId: z.string(),
  bulkRatesUseCustom: z.boolean(),
  tiers: z.array(ZResellerBulkRateTierSchema).max(MAX_RESELLER_BULK_RATE_TIERS),
});

export const ZReplaceResellerBulkRatesResponseSchema = ZGetResellerBulkRatesResponseSchema;

export const ZFindResellerBulkPurchasesRequestSchema = ZFindSearchParamsSchema.extend({
  status: ZOrganisationCreditPurchaseStatusSchema.optional(),
  kind: ZAdminPurchaseInvoiceKindSchema.optional(),
});

export const ZResellerBulkPurchaseSchema = z.object({
  id: z.string(),
  invoiceId: z.string(),
  kind: z.enum(['BULK', 'PAYG', 'RESELLER', 'SUBSCRIPTION']),
  issuer: z.enum(['NOMIA', 'RESELLER']),
  createdAt: z.date(),
  completedAt: z.date().nullable(),
  status: ZOrganisationCreditPurchaseStatusSchema,
  credits: z.number(),
  grossAmount: z.number(),
  currency: z.string(),
  paystackReference: z.string().nullable(),
  pricePerCreditCents: z.number(),
  organisation: z.object({
    id: z.string(),
    name: z.string(),
    url: z.string(),
  }),
  user: z.object({
    id: z.number(),
    name: z.string().nullable(),
    email: z.string(),
  }),
  resellerName: z.string().nullable(),
  resellerAffiliateSlug: z.string().nullable(),
  title: z.string().nullable(),
});

export const ZFindResellerBulkPurchasesResponseSchema = ZFindResultResponse.extend({
  data: ZResellerBulkPurchaseSchema.array(),
});

export type TFindResellerBulkPurchasesResponse = z.infer<
  typeof ZFindResellerBulkPurchasesResponseSchema
>;

