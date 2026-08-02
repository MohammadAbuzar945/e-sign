import { z } from 'zod';

export const ZDeleteResellerRequestSchema = z.object({
  applicationId: z.string(),
});

export const ZDeleteResellerResponseSchema = z.object({
  success: z.literal(true),
});

export type TDeleteResellerRequest = z.infer<typeof ZDeleteResellerRequestSchema>;
export type TDeleteResellerResponse = z.infer<typeof ZDeleteResellerResponseSchema>;
