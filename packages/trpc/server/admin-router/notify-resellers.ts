import { assertResellerNotifyAccess } from '@documenso/lib/constants/demo-feature-flags';
import { getResellerNotifyRecipients } from '@documenso/lib/server-only/reseller/get-reseller-notify-recipients';
import {
  notifyResellers,
  previewResellerBroadcast,
} from '@documenso/lib/server-only/reseller/notify-resellers';

import { adminProcedure } from '../trpc';
import {
  ZGetResellerNotifyRecipientsRequestSchema,
  ZGetResellerNotifyRecipientsResponseSchema,
  ZNotifyResellersRequestSchema,
  ZNotifyResellersResponseSchema,
  ZPreviewResellerNotifyRequestSchema,
  ZPreviewResellerNotifyResponseSchema,
} from './notify-resellers.types';

export const getResellerNotifyRecipientsRoute = adminProcedure
  .input(ZGetResellerNotifyRecipientsRequestSchema)
  .output(ZGetResellerNotifyRecipientsResponseSchema)
  .query(async ({ ctx }) => {
    assertResellerNotifyAccess(ctx.user.email);

    const recipients = await getResellerNotifyRecipients();

    return {
      recipientCount: recipients.length,
      recipients: recipients.map((recipient) => ({
        email: recipient.email,
        name: recipient.name,
        organisationName: recipient.organisationName,
      })),
    };
  });

export const previewResellerNotifyRoute = adminProcedure
  .input(ZPreviewResellerNotifyRequestSchema)
  .output(ZPreviewResellerNotifyResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerNotifyAccess(ctx.user.email);

    const { subject, htmlBody } = input;

    return await previewResellerBroadcast({
      subject,
      htmlBody,
    });
  });

export const notifyResellersRoute = adminProcedure
  .input(ZNotifyResellersRequestSchema)
  .output(ZNotifyResellersResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerNotifyAccess(ctx.user.email);

    const { subject, htmlBody } = input;

    return await notifyResellers({
      subject,
      htmlBody,
      adminUserId: ctx.user.id,
    });
  });
