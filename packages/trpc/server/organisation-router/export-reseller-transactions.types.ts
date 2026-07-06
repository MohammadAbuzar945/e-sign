import { z } from 'zod';

export const ZExportResellerTransactionsRequestSchema = z.object({
  organisationId: z.string(),
  query: z.string().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});

export const ZExportResellerTransactionsResponseSchema = z.object({
  resellerOrganisationName: z.string(),
  resellerVatNumber: z.string().nullable(),
  truncated: z.boolean(),
  count: z.number(),
  data: z.array(
    z.object({
      id: z.string(),
      createdAt: z.date(),
      completedAt: z.date().nullable(),
      credits: z.number(),
      grossAmount: z.number(),
      vatAmount: z.number(),
      netAmount: z.number(),
      currency: z.string(),
      status: z.string(),
      purchaserName: z.string(),
      purchaserEmail: z.string(),
      purchaserOrganisationName: z.string(),
      paystackReference: z.string().nullable(),
    }),
  ),
});
