import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { parseResellerTermsVariableValues } from '@documenso/lib/constants/reseller-terms-variables';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

import { adminProcedure } from '../trpc';
import {
  ZGetResellerApplicationRequestSchema,
  ZGetResellerApplicationResponseSchema,
} from './get-reseller-application.types';

export const getResellerApplicationRoute = adminProcedure
  .input(ZGetResellerApplicationRequestSchema)
  .output(ZGetResellerApplicationResponseSchema)
  .query(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const application = await prisma.resellerApplication.findUnique({
      where: {
        id: input.applicationId,
      },
      select: {
        id: true,
        snapshotOrgName: true,
        snapshotApplicantName: true,
        snapshotApplicantEmail: true,
        termsVariableValues: true,
      },
    });

    if (!application) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Reseller application not found.',
      });
    }

    return {
      id: application.id,
      snapshotOrgName: application.snapshotOrgName,
      snapshotApplicantName: application.snapshotApplicantName,
      snapshotApplicantEmail: application.snapshotApplicantEmail,
      termsVariableValues: parseResellerTermsVariableValues(application.termsVariableValues),
    };
  });
