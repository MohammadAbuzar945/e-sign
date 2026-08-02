import { ZPaystackWebhookEventStatusSchema } from '@documenso/lib/constants/paystack-webhook-event-status';
import { z } from 'zod';

import { ZFindResultResponse, ZFindSearchParamsSchema } from '@documenso/lib/types/search-params';

export const ZFindPaystackWebhookEventsRequestSchema = ZFindSearchParamsSchema.extend({
  status: ZPaystackWebhookEventStatusSchema.optional(),
  event: z.string().optional(),
});

export const ZPaystackWebhookEventSchema = z.object({
  id: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  event: z.string(),
  status: ZPaystackWebhookEventStatusSchema,
  payload: z.unknown(),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  reference: z.string().nullable(),
  customerEmail: z.string().nullable(),
  processedAt: z.date().nullable(),
});

export const ZFindPaystackWebhookEventsResponseSchema = ZFindResultResponse.extend({
  data: ZPaystackWebhookEventSchema.array(),
});

export type TFindPaystackWebhookEventsResponse = z.infer<
  typeof ZFindPaystackWebhookEventsResponseSchema
>;
