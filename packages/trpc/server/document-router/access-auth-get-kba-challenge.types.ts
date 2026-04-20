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
});

export type TAccessAuthGetKbaChallengeRequest = z.infer<
  typeof ZAccessAuthGetKbaChallengeRequestSchema
>;
export type TAccessAuthGetKbaChallengeResponse = z.infer<
  typeof ZAccessAuthGetKbaChallengeResponseSchema
>;

