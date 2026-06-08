import { getEnvelopeKba } from '@documenso/lib/server-only/envelope/get-envelope-kba';

import { authenticatedProcedure } from '../trpc';
import {
  getEnvelopeKbaMeta,
  ZGetEnvelopeKbaRequestSchema,
  ZGetEnvelopeKbaResponseSchema,
} from './get-envelope-kba.types';

export const getEnvelopeKbaRoute = authenticatedProcedure
  .meta(getEnvelopeKbaMeta)
  .input(ZGetEnvelopeKbaRequestSchema)
  .output(ZGetEnvelopeKbaResponseSchema)
  .query(async ({ input, ctx }) => {
    return await getEnvelopeKba({
      userId: ctx.user.id,
      teamId: ctx.teamId,
      envelopeId: input.envelopeId,
    });
  });
