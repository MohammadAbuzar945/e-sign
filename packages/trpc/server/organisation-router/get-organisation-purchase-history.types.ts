import { z } from 'zod';

export const ZGetOrganisationPurchaseHistoryRequestSchema = z.object({
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
  kind: z.enum(['subscription', 'pay_as_you_go', 'reseller', 'hybrid', 'bulk']),
  title: z.string(),
  totalCredits: z.number(),
  totalGrossAmount: z.number(),
  currency: z.string(),
  status: z.string(),
  lineItems: z.array(ZPurchaseHistoryLineItemSchema),
});

export const ZGetOrganisationPurchaseHistoryResponseSchema = z.array(
  ZOrganisationPurchaseHistoryItemSchema,
);
