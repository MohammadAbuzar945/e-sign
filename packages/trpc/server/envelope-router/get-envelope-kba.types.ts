import { z } from 'zod';

import type { TrpcRouteMeta } from '../trpc';

export const getEnvelopeKbaMeta: TrpcRouteMeta = {
  openapi: {
    method: 'GET',
    path: '/envelope/{envelopeId}/kba',
    summary: 'Get envelope KBA config',
    tags: ['Envelope'],
  },
};

export const ZGetEnvelopeKbaRequestSchema = z.object({
  envelopeId: z.string(),
});

export const ZGetEnvelopeKbaResponseSchema = z.object({
  settings: z
    .object({
      mode: z.enum(['PER_ENVELOPE', 'PER_RECIPIENT']),
      isEnabled: z.boolean(),
      maxAttempts: z.number().int(),
      lockoutMinutes: z.number().int(),
    })
    .nullable(),
  envelopeChallenge: z
    .object({
      answerType: z.enum(['STRING', 'NUMERIC', 'MCQ']),
      question: z.string(),
      mcqOptions: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
        }),
      ),
      isAnswerConfigured: z.boolean(),
    })
    .nullable(),
  recipientChallenges: z.array(
    z.object({
      recipientId: z.number(),
      answerType: z.enum(['STRING', 'NUMERIC', 'MCQ']),
      question: z.string(),
      mcqOptions: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
        }),
      ),
      isAnswerConfigured: z.boolean(),
    }),
  ),
});

export type TGetEnvelopeKbaRequest = z.infer<typeof ZGetEnvelopeKbaRequestSchema>;
export type TGetEnvelopeKbaResponse = z.infer<typeof ZGetEnvelopeKbaResponseSchema>;

