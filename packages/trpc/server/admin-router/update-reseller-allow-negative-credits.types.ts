import { z } from 'zod';

export const ZUpdateResellerAllowNegativeCreditsRequestSchema = z.object({
  applicationId: z.string(),
  allowNegativeCredits: z.boolean(),
});

export const ZUpdateResellerAllowNegativeCreditsResponseSchema = z.object({
  success: z.literal(true),
  allowNegativeCredits: z.boolean(),
});

export type TUpdateResellerAllowNegativeCreditsRequest = z.infer<
  typeof ZUpdateResellerAllowNegativeCreditsRequestSchema
>;
export type TUpdateResellerAllowNegativeCreditsResponse = z.infer<
  typeof ZUpdateResellerAllowNegativeCreditsResponseSchema
>;
