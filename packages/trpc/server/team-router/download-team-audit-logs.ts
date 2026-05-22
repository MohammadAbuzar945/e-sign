import { PDF_SIZE_A4_72PPI } from '@documenso/lib/constants/pdf';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { generateTeamAuditLogPdf } from '@documenso/lib/server-only/pdf/generate-team-audit-log-pdf';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDownloadTeamAuditLogsRequestSchema,
  ZDownloadTeamAuditLogsResponseSchema,
} from './download-team-audit-logs.types';

export const downloadTeamAuditLogsRoute = authenticatedProcedure
  .input(ZDownloadTeamAuditLogsRequestSchema)
  .output(ZDownloadTeamAuditLogsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId } = input;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: ctx.user.id,
      }),
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to this team.',
      });
    }

    const auditLogPdf = await generateTeamAuditLogPdf({
      teamId,
      pageWidth: PDF_SIZE_A4_72PPI.width,
      pageHeight: PDF_SIZE_A4_72PPI.height,
    });

    const result = await auditLogPdf.save();

    const base64 = Buffer.from(result).toString('base64');

    return {
      data: base64,
      teamName: team.name,
    };
  });

