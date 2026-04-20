import { z } from 'zod';

export const ZAccessAuthVerifyKbaRequestSchema = z.object({
  token: z.string().min(1),
  answer: z.string().min(1),
});

export const ZAccessAuthVerifyKbaResponseSchema = z.object({
  success: z.boolean(),
  isLocked: z.boolean(),
  attemptsRemaining: z.number().int().min(0),
});

export type TAccessAuthVerifyKbaRequest = z.infer<typeof ZAccessAuthVerifyKbaRequestSchema>;
export type TAccessAuthVerifyKbaResponse = z.infer<typeof ZAccessAuthVerifyKbaResponseSchema>;

