import { z } from 'zod';

export const ZGetEffectiveResellerBulkRatesRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZGetEffectiveResellerBulkRatesResponseSchema = z
  .object({
    resellerProfileId: z.string(),
    source: z.enum(['CUSTOM', 'GLOBAL', 'MERGED']),
    tiers: z.array(
      z.object({
        minCredits: z.number(),
        pricePerCreditCents: z.number(),
      }),
    ),
  })
  .nullable();

export const ZInitializeResellerBulkPurchaseRequestSchema = z.object({
  organisationId: z.string(),
  credits: z.number().int().positive(),
});

export const ZInitializeResellerBulkPurchaseResponseSchema = z.object({
  authorizationUrl: z.string(),
  reference: z.string(),
  credits: z.number(),
  amountInCents: z.number(),
  ratePerCreditCents: z.number(),
  source: z.enum(['CUSTOM', 'GLOBAL', 'MERGED']),
});
