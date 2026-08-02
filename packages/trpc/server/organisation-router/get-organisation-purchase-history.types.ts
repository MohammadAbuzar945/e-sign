import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZGetOrganisationPurchaseHistoryRequestSchema = ZFindSearchParamsSchema.pick({
  page: true,
  perPage: true,
}).extend({
  organisationId: z.string(),
});

export const ZPurchaseHistoryLineItemSchema = z.object({
  provider: z.enum(['nomia', 'reseller']),
  description: z.string(),
  credits: z.number(),
  grossAmount: z.number(),
  currency: z.string(),
  status: z.string(),
  reference: z.string().nullable(),
});

export const ZOrganisationPurchaseHistoryItemSchema = z.object({
  invoiceId: z.string(),
  purchaseGroupId: z.string().nullable(),
  date: z.date(),
  kind: z.enum(['subscription', 'pay_as_you_go', 'reseller', 'bulk']),
  issuer: z.enum(['NOMIA', 'RESELLER']),
  title: z.string(),
  totalCredits: z.number(),
  totalGrossAmount: z.number(),
  currency: z.string(),
  status: z.string(),
  lineItems: z.array(ZPurchaseHistoryLineItemSchema),
  buyerVatNumber: z.string().nullable().optional(),
  resellerSeller: z
    .object({
      name: z.string(),
      physicalAddress: z.string().nullable(),
      vatStatus: z.enum(['NOT_REGISTERED', 'REGISTERED']).nullable(),
      vatNumber: z.string().nullable(),
      affiliateSlug: z.string(),
      hasLogo: z.boolean(),
    })
    .nullable()
    .optional(),
});

export const ZGetOrganisationPurchaseHistoryResponseSchema = ZFindResultResponse.extend({
  data: z.array(ZOrganisationPurchaseHistoryItemSchema),
});
