import { z } from 'zod';

export const ZReactivateResellerProfileRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZReactivateResellerProfileResponseSchema = z.object({
  success: z.literal(true),
});

export type TReactivateResellerProfileRequest = z.infer<
  typeof ZReactivateResellerProfileRequestSchema
>;
export type TReactivateResellerProfileResponse = z.infer<
  typeof ZReactivateResellerProfileResponseSchema
>;
