import { updateOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZUpdateAdminOrganisationCreditsRequestSchema,
  ZUpdateAdminOrganisationCreditsResponseSchema,
} from './update-admin-organisation-credits.types';

export const updateAdminOrganisationCreditsRoute = adminProcedure
  .input(ZUpdateAdminOrganisationCreditsRequestSchema)
  .output(ZUpdateAdminOrganisationCreditsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId, credits } = input;

    ctx.logger.info({
      input: { organisationId, credits },
    });

    const organisation = await prisma.organisation.findUnique({
      where: { id: organisationId },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    await updateOrganisationCredits(organisationId, credits);
  });
