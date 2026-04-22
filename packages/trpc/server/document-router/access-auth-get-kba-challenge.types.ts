import { z } from 'zod';

import { ZDocumentKbaAnswerTypeSchema, ZDocumentKbaOptionSchema } from '@documenso/lib/types/document-auth';

export const ZAccessAuthGetKbaChallengeRequestSchema = z.object({
  token: z.string().min(1),
});

export const ZAccessAuthGetKbaChallengeResponseSchema = z.object({
  challengeId: z.string(),
  answerType: ZDocumentKbaAnswerTypeSchema,
  question: z.string(),
  mcqOptions: z.array(ZDocumentKbaOptionSchema),
  maxAttempts: z.number().int().min(1),
  lockoutMinutes: z.number().int().min(1),
  isLocked: z.boolean(),
  lockoutRemainingSeconds: z.number().int().min(0),
});

export type TAccessAuthGetKbaChallengeRequest = z.infer<
  typeof ZAccessAuthGetKbaChallengeRequestSchema
>;
export type TAccessAuthGetKbaChallengeResponse = z.infer<
  typeof ZAccessAuthGetKbaChallengeResponseSchema
>;

