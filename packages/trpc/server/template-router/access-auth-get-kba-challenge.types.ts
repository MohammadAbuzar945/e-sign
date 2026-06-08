import { ZDocumentKbaAnswerTypeSchema, ZDocumentKbaOptionSchema } from '@documenso/lib/types/document-auth';
import { z } from 'zod';

export const ZTemplateAccessAuthGetKbaChallengeRequestSchema = z.object({
  token: z.string().min(1),
});

export const ZTemplateAccessAuthGetKbaChallengeResponseSchema = z.object({
  challengeId: z.string(),
  answerType: ZDocumentKbaAnswerTypeSchema,
  question: z.string(),
  mcqOptions: z.array(ZDocumentKbaOptionSchema),
  maxAttempts: z.number().int().min(1),
  lockoutMinutes: z.number().int().min(1),
  isLocked: z.boolean(),
  lockoutRemainingSeconds: z.number().int().min(0),
});
