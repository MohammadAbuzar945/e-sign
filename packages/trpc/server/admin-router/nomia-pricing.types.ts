import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const getNomiaPricePlansMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/admin/nomia-pricing',
    summary: 'List Nomia PAYG and subscription price plans',
    tags: ['Admin'],
  },
};

export const updateNomiaPricePlansMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/admin/nomia-pricing',
    summary: 'Update Nomia PAYG and subscription price plans',
    tags: ['Admin'],
  },
};

export const ZNomiaPricePlanCategorySchema = z.enum(['PAYG', 'MONTHLY', 'ANNUAL']);

export const ZNomiaPricePlanSchema = z.object({
  id: z.string(),
  category: ZNomiaPricePlanCategorySchema,
  name: z.string(),
  credits: z.number().int().positive(),
  priceInCents: z.number().int().positive(),
  currency: z.string(),
  paystackPlanCodeTest: z.string().min(1),
  paystackPlanCodeLive: z.string().min(1),
  isEnabled: z.boolean(),
  sortOrder: z.number().int(),
});

export const ZGetNomiaPricePlansRequestSchema = z.void();

export const ZGetNomiaPricePlansResponseSchema = z.object({
  plans: z.array(ZNomiaPricePlanSchema),
});

export const ZUpdateNomiaPricePlanItemSchema = z.object({
  id: z.string().min(1),
  credits: z.number().int().positive(),
  priceInCents: z.number().int().positive(),
  isEnabled: z.boolean(),
  paystackPlanCodeTest: z.string().min(1),
  paystackPlanCodeLive: z.string().min(1),
});

export const ZUpdateNomiaPricePlansRequestSchema = z.object({
  plans: z.array(ZUpdateNomiaPricePlanItemSchema).min(1),
});

export const ZUpdateNomiaPricePlansResponseSchema = ZGetNomiaPricePlansResponseSchema;

export type TGetNomiaPricePlansResponse = z.infer<typeof ZGetNomiaPricePlansResponseSchema>;
export type TUpdateNomiaPricePlansRequest = z.infer<typeof ZUpdateNomiaPricePlansRequestSchema>;
