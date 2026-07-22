import { z } from 'zod';

export const ZMarkResellerDelinquentRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZMarkResellerDelinquentResponseSchema = z.object({
  success: z.literal(true),
});

export type TMarkResellerDelinquentRequest = z.infer<typeof ZMarkResellerDelinquentRequestSchema>;
export type TMarkResellerDelinquentResponse = z.infer<typeof ZMarkResellerDelinquentResponseSchema>;
