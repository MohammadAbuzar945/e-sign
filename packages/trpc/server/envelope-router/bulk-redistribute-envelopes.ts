import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { jobs } from '@documenso/lib/jobs/client';
import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { prisma } from '@documenso/prisma';
import { authenticatedProcedure } from '../trpc';
import {
  ZBulkRedistributeEnvelopesRequestSchema,
  ZBulkRedistributeEnvelopesResponseSchema,
} from './bulk-redistribute-envelopes.types';

export const bulkRedistributeEnvelopesRoute = authenticatedProcedure
  // .meta(bulkRedistributeEnvelopesMeta) // Keeping this as a private API for a little while until we're sure it's stable and the request/response schemas are finalized.
  .input(ZBulkRedistributeEnvelopesRequestSchema)
  .output(ZBulkRedistributeEnvelopesResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, user } = ctx;
    const { envelopeIds } = input;

    ctx.logger.info({
      input: {
        envelopeIds,
      },
    });

    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'envelopeId',
        ids: envelopeIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    // Resolve which envelopes are actually eligible so we can report an
    // accurate queued count. The heavy lifting (emailing every recipient) runs
    // asynchronously in a background job so the request returns immediately.
    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      select: {
        id: true,
        status: true,
      },
    });

    const pendingEnvelopeIds = envelopes
      .filter((envelope) => envelope.status === DocumentStatus.PENDING)
      .map((envelope) => envelope.id);

    if (pendingEnvelopeIds.length > 0) {
      await jobs.triggerJob({
        name: 'internal.bulk-resend-envelopes',
        payload: {
          userId: user.id,
          teamId,
          envelopeIds: pendingEnvelopeIds,
          requestMetadata: ctx.metadata.requestMetadata,
        },
      });
    }

    return {
      queuedCount: pendingEnvelopeIds.length,
      skippedCount: envelopeIds.length - pendingEnvelopeIds.length,
    };
  });
