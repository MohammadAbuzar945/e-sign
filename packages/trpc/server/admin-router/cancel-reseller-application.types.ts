import { z } from 'zod';

export const ZCancelResellerApplicationRequestSchema = z.object({
  applicationId: z.string(),
  cancellationReason: z.string().optional(),
});

export const ZCancelResellerApplicationResponseSchema = z.object({
  success: z.literal(true),
});

export type TCancelResellerApplicationRequest = z.infer<
  typeof ZCancelResellerApplicationRequestSchema
>;
export type TCancelResellerApplicationResponse = z.infer<
  typeof ZCancelResellerApplicationResponseSchema
>;
