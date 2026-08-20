import { z } from 'zod';

// READ ME: IF YOU UNCOMMENT THIS THEN ADD THE MATCHING API ACCESS TEST.
// Keeping this as a private API for a little while until we're sure it's stable and the request/response schemas are finalized.
// export const bulkRedistributeEnvelopesMeta: TrpcRouteMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/envelope/bulk/redistribute',
//     summary: 'Bulk redistribute envelopes',
//     description:
//       'Resend the signing invitation to all recipients who have not signed for multiple envelopes.',
//     tags: ['Envelopes'],
//   },
// };

export const ZBulkRedistributeEnvelopesRequestSchema = z.object({
  envelopeIds: z
    .array(z.string())
    .min(1)
    .max(100)
    .describe(
      'The IDs of the envelopes to redistribute. The maximum number of envelopes you can redistribute at once is 100.',
    ),
});

export const ZBulkRedistributeEnvelopesResponseSchema = z.object({
  queuedCount: z
    .number()
    .describe('The number of envelopes queued to have their reminders resent in the background.'),
  skippedCount: z
    .number()
    .describe(
      'The number of envelopes that were skipped because they were not pending or not accessible.',
    ),
});

export type TBulkRedistributeEnvelopesRequest = z.infer<
  typeof ZBulkRedistributeEnvelopesRequestSchema
>;
export type TBulkRedistributeEnvelopesResponse = z.infer<
  typeof ZBulkRedistributeEnvelopesResponseSchema
>;
