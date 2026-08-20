import { z } from 'zod';

import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import { type JobDefinition } from '../../client/_internal/job';

const BULK_RESEND_ENVELOPES_JOB_DEFINITION_ID = 'internal.bulk-resend-envelopes';

const BULK_RESEND_ENVELOPES_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
  teamId: z.number(),
  envelopeIds: z.array(z.string()).min(1),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TBulkResendEnvelopesJobDefinition = z.infer<
  typeof BULK_RESEND_ENVELOPES_JOB_DEFINITION_SCHEMA
>;

export const BULK_RESEND_ENVELOPES_JOB_DEFINITION = {
  id: BULK_RESEND_ENVELOPES_JOB_DEFINITION_ID,
  name: 'Bulk Resend Envelopes',
  version: '1.0.0',
  trigger: {
    name: BULK_RESEND_ENVELOPES_JOB_DEFINITION_ID,
    schema: BULK_RESEND_ENVELOPES_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./bulk-resend-envelopes.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof BULK_RESEND_ENVELOPES_JOB_DEFINITION_ID,
  TBulkResendEnvelopesJobDefinition
>;
