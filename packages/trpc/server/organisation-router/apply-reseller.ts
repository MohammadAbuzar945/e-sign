import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { createResellerApplication } from '@documenso/lib/server-only/reseller/create-reseller-application';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZApplyResellerRequestSchema, ZApplyResellerResponseSchema } from './apply-reseller.types';

export const applyResellerRoute = authenticatedProcedure
  .input(ZApplyResellerRequestSchema)
  .output(ZApplyResellerResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, variableValues } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const application = await createResellerApplication({
      organisationId,
      applicantUserId: ctx.user.id,
      applicantUserEmail: ctx.user.email,
      variableValues,
    });

    return {
      applicationId: application.id,
      status: application.status,
    };
  });
