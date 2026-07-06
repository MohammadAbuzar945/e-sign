import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import {
  findResellerTransactions,
  getResellerProfileByOrganisationId,
  updateResellerPackages,
  updateResellerProfile,
} from '@documenso/lib/server-only/reseller/reseller-profile';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindResellerTransactionsRequestSchema,
  ZFindResellerTransactionsResponseSchema,
  ZGetResellerProfileRequestSchema,
  ZGetResellerProfileResponseSchema,
  ZUpdateResellerPackagesRequestSchema,
  ZUpdateResellerPackagesResponseSchema,
  ZUpdateResellerProfileRequestSchema,
  ZUpdateResellerProfileResponseSchema,
} from './reseller-profile.types';

export const getResellerProfileRoute = authenticatedProcedure
  .input(ZGetResellerProfileRequestSchema)
  .output(ZGetResellerProfileResponseSchema)
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

    return await getResellerProfileByOrganisationId(organisationId);
  });

export const updateResellerProfileRoute = authenticatedProcedure
  .input(ZUpdateResellerProfileRequestSchema)
  .output(ZUpdateResellerProfileResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, data } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    await updateResellerProfile({
      organisationId,
      paystackPublicKey: data.paystackPublicKey,
      paystackSecretKey: data.paystackSecretKey,
      vatNumber: data.vatNumber,
      instructionsDismissed: data.instructionsDismissed,
    });

    return { success: true as const };
  });

export const updateResellerPackagesRoute = authenticatedProcedure
  .input(ZUpdateResellerPackagesRequestSchema)
  .output(ZUpdateResellerPackagesResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, enabledCatalogPackageIds } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    return await updateResellerPackages({
      organisationId,
      enabledCatalogPackageIds,
    });
  });

export const findResellerTransactionsRoute = authenticatedProcedure
  .input(ZFindResellerTransactionsRequestSchema)
  .output(ZFindResellerTransactionsResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId, query, page, perPage, fromDate, toDate } = input;

    assertResellerFeatureAccess(ctx.user.email);

    await prisma.organisation.findFirstOrThrow({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
    });

    return await findResellerTransactions({
      organisationId,
      query,
      page,
      perPage,
      fromDate,
      toDate,
    });
  });
