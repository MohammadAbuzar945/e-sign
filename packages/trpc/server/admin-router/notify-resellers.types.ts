import { z } from 'zod';

export const ZResellerBroadcastContentSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(1, 'Subject is required')
    .max(200, 'Subject must be 200 characters or fewer'),
  htmlBody: z
    .string()
    .trim()
    .min(1, 'Message body is required')
    .max(100_000, 'Message body is too large'),
});

export const ZGetResellerNotifyRecipientsRequestSchema = z.void();

export const ZGetResellerNotifyRecipientsResponseSchema = z.object({
  recipientCount: z.number().int().nonnegative(),
  recipients: z.array(
    z.object({
      email: z.string().email(),
      name: z.string(),
      organisationName: z.string(),
    }),
  ),
});

export const ZPreviewResellerNotifyRequestSchema = ZResellerBroadcastContentSchema;

export const ZPreviewResellerNotifyResponseSchema = z.object({
  html: z.string(),
  subject: z.string(),
  recipientCount: z.number().int().nonnegative(),
});

export const ZNotifyResellersRequestSchema = ZResellerBroadcastContentSchema;

export const ZNotifyResellersResponseSchema = z.object({
  recipientCount: z.number().int().nonnegative(),
  sentCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
});

export type TGetResellerNotifyRecipientsResponse = z.infer<
  typeof ZGetResellerNotifyRecipientsResponseSchema
>;
export type TPreviewResellerNotifyRequest = z.infer<typeof ZPreviewResellerNotifyRequestSchema>;
export type TPreviewResellerNotifyResponse = z.infer<typeof ZPreviewResellerNotifyResponseSchema>;
export type TNotifyResellersRequest = z.infer<typeof ZNotifyResellersRequestSchema>;
export type TNotifyResellersResponse = z.infer<typeof ZNotifyResellersResponseSchema>;
