import { z } from 'zod';

export const ZCompletePendingResellerTransactionRequestSchema = z.object({
  organisationId: z.string(),
  transactionId: z.string(),
});

export const ZCompletePendingResellerTransactionResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  completedAt: z.date().nullable(),
});
