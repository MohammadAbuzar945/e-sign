import { DocumentStatus, EnvelopeType } from '@prisma/client';
import pMap from 'p-map';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resendDocument } from '@documenso/lib/server-only/document/resend-document';
import { getMultipleEnvelopeWhereInput } from '@documenso/lib/server-only/envelope/get-envelopes-by-ids';
import { canUserBulkResend } from '@documenso/lib/utils/bulk-resend-access';
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

    if (!canUserBulkResend(user.email)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to bulk resend documents.',
      });
    }

    const { envelopeWhereInput } = await getMultipleEnvelopeWhereInput({
      ids: {
        type: 'envelopeId',
        ids: envelopeIds,
      },
      userId: user.id,
      teamId,
      type: EnvelopeType.DOCUMENT,
    });

    // Only fetch the id + status. Recipients are loaded per-envelope inside
    // `resendDocument` so we never hold all recipients in memory at once.
    const envelopes = await prisma.envelope.findMany({
      where: envelopeWhereInput,
      select: {
        id: true,
        status: true,
      },
    });

    const isPrismaTransactionTimeout = (err: unknown) =>
      typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2028';

    const results = await pMap(
      envelopes,
      async (envelope) => {
        const { id: envelopeId, status } = envelope;

        // Enforce pending-only on the server regardless of client gating.
        if (status !== DocumentStatus.PENDING) {
          return { outcome: 'skipped' as const, envelopeId };
        }

        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            await resendDocument({
              id: {
                type: 'envelopeId',
                id: envelopeId,
              },
              userId: user.id,
              teamId,
              requestMetadata: ctx.metadata,
            });

            return { outcome: 'resent' as const, envelopeId };
          } catch (err) {
            const shouldRetry = isPrismaTransactionTimeout(err) && attempt < maxAttempts;

            ctx.logger.warn(
              {
                envelopeId,
                attempt,
                willRetry: shouldRetry,
                error: err,
              },
              'Failed to resend envelope during bulk redistribute',
            );

            if (!shouldRetry) {
              return { outcome: 'failed' as const, envelopeId };
            }

            await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          }
        }

        return { outcome: 'failed' as const, envelopeId };
      },
      {
        // Keep this low so reminder mail + audit writes cannot starve the pool.
        concurrency: 2,
        stopOnError: false,
      },
    );

    const resentCount = results.filter((r) => r.outcome === 'resent').length;
    const skippedCount = results.filter((r) => r.outcome === 'skipped').length;
    const failedIds = results.filter((r) => r.outcome === 'failed').map((r) => r.envelopeId);

    // Include envelope IDs that were not attempted (unauthorized/not found).
    const attemptedIds = new Set(envelopes.map((e) => e.id));
    const unattemptedIds = envelopeIds.filter((id) => !attemptedIds.has(id));

    return {
      resentCount,
      skippedCount,
      failedIds: [...failedIds, ...unattemptedIds],
    };
  });
