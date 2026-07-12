import { z } from 'zod';

export const ZDeactivateResellerProfileRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZDeactivateResellerProfileResponseSchema = z.object({
  success: z.literal(true),
});

export type TDeactivateResellerProfileRequest = z.infer<
  typeof ZDeactivateResellerProfileRequestSchema
>;
export type TDeactivateResellerProfileResponse = z.infer<
  typeof ZDeactivateResellerProfileResponseSchema
>;
