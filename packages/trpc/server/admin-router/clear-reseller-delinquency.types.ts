import { z } from 'zod';

export const ZClearResellerDelinquencyRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZClearResellerDelinquencyResponseSchema = z.object({
  success: z.literal(true),
});

export type TClearResellerDelinquencyRequest = z.infer<
  typeof ZClearResellerDelinquencyRequestSchema
>;
export type TClearResellerDelinquencyResponse = z.infer<
  typeof ZClearResellerDelinquencyResponseSchema
>;
