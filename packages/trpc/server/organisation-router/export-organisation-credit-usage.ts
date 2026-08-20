import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { findOrganisationCreditUsage } from '@documenso/lib/server-only/billing/organisation-credit-usage';
import { canDownloadCreditUsage } from '@documenso/lib/utils/credit-usage-download-access';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZExportOrganisationCreditUsageRequestSchema,
  ZExportOrganisationCreditUsageResponseSchema,
} from './export-organisation-credit-usage.types';

export const exportOrganisationCreditUsageRoute = authenticatedProcedure
  .input(ZExportOrganisationCreditUsageRequestSchema)
  .output(ZExportOrganisationCreditUsageResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;

    if (!canDownloadCreditUsage(ctx.user.email)) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'Credit usage download is not available for this account',
      });
    }

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: ctx.user.id,
      }),
      select: {
        id: true,
        name: true,
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Organisation not found',
      });
    }

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const rows = await findOrganisationCreditUsage(organisation.id);
    const totalCredits = rows.reduce((sum, row) => sum + row.credits, 0);

    return {
      organisationName: organisation.name,
      count: rows.length,
      totalCredits,
      data: rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        teamId: row.teamId,
        teamName: row.teamName,
        documentId: row.documentId,
        credits: row.credits,
      })),
    };
  });
