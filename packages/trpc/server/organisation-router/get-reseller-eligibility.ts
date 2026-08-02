import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { getResellerEligibility } from '@documenso/lib/server-only/reseller/get-reseller-eligibility';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZGetResellerEligibilityRequestSchema,
  ZGetResellerEligibilityResponseSchema,
} from './get-reseller-eligibility.types';

export const getResellerEligibilityRoute = authenticatedProcedure
  .input(ZGetResellerEligibilityRequestSchema)
  .output(ZGetResellerEligibilityResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    return await getResellerEligibility({
      organisationId,
      userEmail: ctx.user.email,
    });
  });
