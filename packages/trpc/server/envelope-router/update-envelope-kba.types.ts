import { z } from 'zod';

import {
  ZDocumentKbaChallengeInputSchema,
  ZDocumentKbaSettingsSchema,
} from '@documenso/lib/types/document-auth';

import type { TrpcRouteMeta } from '../trpc';

export const updateEnvelopeKbaMeta: TrpcRouteMeta = {
  openapi: {
    method: 'POST',
    path: '/envelope/kba/update',
    summary: 'Update envelope KBA settings',
    tags: ['Envelope'],
  },
};

export const ZUpdateEnvelopeKbaRequestSchema = z.object({
  envelopeId: z.string(),
  settings: ZDocumentKbaSettingsSchema,
  envelopeChallenge: ZDocumentKbaChallengeInputSchema.nullish(),
  recipientChallenges: z
    .array(
      z.intersection(
        ZDocumentKbaChallengeInputSchema,
        z.object({
          recipientId: z.number(),
        }),
      ),
    )
    .default([]),
});

export const ZUpdateEnvelopeKbaResponseSchema = z.object({
  success: z.literal(true),
});

export type TUpdateEnvelopeKbaRequest = z.infer<typeof ZUpdateEnvelopeKbaRequestSchema>;
export type TUpdateEnvelopeKbaResponse = z.infer<typeof ZUpdateEnvelopeKbaResponseSchema>;

