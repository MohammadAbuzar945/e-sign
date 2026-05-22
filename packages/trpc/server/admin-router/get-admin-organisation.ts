import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getCurrentSubscriptionByOrganisationId } from '@documenso/lib/server-only/subscription/get-current-subscription-by-organisation-id';
import { prisma } from '@documenso/prisma';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';

import { adminProcedure } from '../trpc';
import {
  ZGetAdminOrganisationRequestSchema,
  ZGetAdminOrganisationResponseSchema,
} from './get-admin-organisation.types';

export const getAdminOrganisationRoute = adminProcedure
  .input(ZGetAdminOrganisationRequestSchema)
  .output(ZGetAdminOrganisationResponseSchema)
  .query(async ({ input, ctx }) => {
    const { organisationId } = input;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    return await getAdminOrganisation({
      organisationId,
    });
  });

type GetOrganisationOptions = {
  organisationId: string;
};

export const getAdminOrganisation = async ({ organisationId }: GetOrganisationOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      id: organisationId,
    },
    include: {
      organisationClaim: true,
      organisationGlobalSettings: true,
      teams: true,
      members: {
        include: {
          organisationGroupMembers: {
            include: {
              group: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!organisation) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Organisation not found',
    });
  }

  const subscription = await getCurrentSubscriptionByOrganisationId({
    organisationId: organisation.id,
  });

  let credits = 0;
  try {
    credits = await getOrganisationCredits(organisation.id);
  } catch {
    // Credits feature may be unavailable (e.g. missing UserCredits table)
  }

  return {
    ...organisation,
    subscription,
    credits,
  };
};
