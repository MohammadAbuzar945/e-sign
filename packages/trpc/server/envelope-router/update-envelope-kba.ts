import { updateEnvelopeKba } from '@documenso/lib/server-only/envelope/update-envelope-kba';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateEnvelopeKbaRequestSchema,
  ZUpdateEnvelopeKbaResponseSchema,
  updateEnvelopeKbaMeta,
} from './update-envelope-kba.types';

export const updateEnvelopeKbaRoute = authenticatedProcedure
  .meta(updateEnvelopeKbaMeta)
  .input(ZUpdateEnvelopeKbaRequestSchema)
  .output(ZUpdateEnvelopeKbaResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { user, teamId } = ctx;

    return await updateEnvelopeKba({
      userId: user.id,
      teamId,
      envelopeId: input.envelopeId,
      settings: input.settings,
      envelopeChallenge: input.envelopeChallenge ?? null,
      recipientChallenges: input.recipientChallenges,
      actor: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      requestMetadata: {
        userAgent: ctx.metadata.requestMetadata.userAgent ?? undefined,
        ipAddress: ctx.metadata.requestMetadata.ipAddress ?? undefined,
      },
    });
  });

