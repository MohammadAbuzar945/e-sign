import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { updateResellerAffiliateSlug } from '@documenso/lib/server-only/reseller/affiliate-slug';
import { buildAffiliateUrl } from '@documenso/lib/utils/affiliate-slug';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZUpdateResellerAffiliateSlugRequestSchema,
  ZUpdateResellerAffiliateSlugResponseSchema,
} from './update-reseller-affiliate-slug.types';

export const updateResellerAffiliateSlugRoute = authenticatedProcedure
  .input(ZUpdateResellerAffiliateSlugRequestSchema)
  .output(ZUpdateResellerAffiliateSlugResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, affiliateSlug } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    const profile = await updateResellerAffiliateSlug({
      organisationId,
      affiliateSlug,
    });

    return {
      affiliateSlug: profile.affiliateSlug,
      affiliateUrl: buildAffiliateUrl(profile.affiliateSlug, NEXT_PUBLIC_WEBAPP_URL()),
    };
  });
