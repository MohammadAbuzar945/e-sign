import { getPendingOrganisationInvites } from '@documenso/lib/server-only/admin/send-organisation-invite-reminders';
import { assertInviteReminderFeatureAccess } from '@documenso/lib/utils/invite-reminder-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZGetAdminOrganisationPendingInvitesRequestSchema,
  ZGetAdminOrganisationPendingInvitesResponseSchema,
} from './get-admin-organisation-pending-invites.types';

export const getAdminOrganisationPendingInvitesRoute = adminProcedure
  .input(ZGetAdminOrganisationPendingInvitesRequestSchema)
  .output(ZGetAdminOrganisationPendingInvitesResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    assertInviteReminderFeatureAccess(ctx.user.email);

    ctx.logger.info({
      input: { organisationId },
    });

    const invites = await getPendingOrganisationInvites(organisationId);

    return { invites };
  });
