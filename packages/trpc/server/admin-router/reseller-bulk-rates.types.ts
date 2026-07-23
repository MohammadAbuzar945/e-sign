import { z } from 'zod';

import { MAX_RESELLER_BULK_RATE_TIERS } from '@documenso/lib/constants/reseller-bulk-rates';
import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZOrganisationCreditPurchaseStatusSchema = z.enum([
  'PENDING',
  'COMPLETED',
  'FAILED',
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
});

export const ZResellerBulkPurchaseSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  completedAt: z.date().nullable(),
  status: ZOrganisationCreditPurchaseStatusSchema,
  credits: z.number(),
  grossAmount: z.number(),
  currency: z.string(),
  paystackReference: z.string(),
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
});

export const ZFindResellerBulkPurchasesResponseSchema = ZFindResultResponse.extend({
  data: ZResellerBulkPurchaseSchema.array(),
});

export type TFindResellerBulkPurchasesResponse = z.infer<
  typeof ZFindResellerBulkPurchasesResponseSchema
>;

