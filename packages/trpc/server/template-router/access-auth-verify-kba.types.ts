import { z } from 'zod';

export const ZTemplateAccessAuthVerifyKbaRequestSchema = z.object({
  token: z.string().min(1),
  answer: z.string().min(1),
});

export const ZTemplateAccessAuthVerifyKbaResponseSchema = z.object({
  success: z.boolean(),
  isLocked: z.boolean(),
  attemptsRemaining: z.number().int().min(0),
  lockoutRemainingSeconds: z.number().int().min(0),
});
