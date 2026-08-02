import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { checkResellerAffiliateSlugAvailability } from '@documenso/lib/server-only/reseller/affiliate-slug';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZCheckResellerAffiliateSlugRequestSchema,
  ZCheckResellerAffiliateSlugResponseSchema,
} from './check-reseller-affiliate-slug.types';

export const checkResellerAffiliateSlugRoute = authenticatedProcedure
  .input(ZCheckResellerAffiliateSlugRequestSchema)
  .output(ZCheckResellerAffiliateSlugResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, affiliateSlug } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    return await checkResellerAffiliateSlugAvailability({
      organisationId,
      affiliateSlug,
    });
  });
