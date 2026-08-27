import { sendOrganisationInviteReminders } from '@documenso/lib/server-only/admin/send-organisation-invite-reminders';
import { assertInviteReminderFeatureAccess } from '@documenso/lib/utils/invite-reminder-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZSendAdminOrganisationInviteRemindersRequestSchema,
  ZSendAdminOrganisationInviteRemindersResponseSchema,
} from './send-admin-organisation-invite-reminders.types';

export const sendAdminOrganisationInviteRemindersRoute = adminProcedure
  .input(ZSendAdminOrganisationInviteRemindersRequestSchema)
  .output(ZSendAdminOrganisationInviteRemindersResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, invitationIds } = input;

    assertInviteReminderFeatureAccess(ctx.user.email);

    ctx.logger.info({
      input: {
        organisationId,
        invitationIds,
      },
    });

    return await sendOrganisationInviteReminders({
      organisationId,
      invitationIds,
    });
  });
