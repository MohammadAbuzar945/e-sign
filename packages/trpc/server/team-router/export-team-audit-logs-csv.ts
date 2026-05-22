import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { prefixedId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID } from '@documenso/lib/jobs/definitions/internal/export-team-audit-logs-csv';
import {
  ZExportTeamAuditLogsCsvRequestSchema,
  ZExportTeamAuditLogsCsvResponseSchema,
} from './export-team-audit-logs-csv.types';

export const exportTeamAuditLogsCsvRoute = authenticatedProcedure
  .input(ZExportTeamAuditLogsCsvRequestSchema)
  .output(ZExportTeamAuditLogsCsvResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, dateRange } = input;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    const team = await prisma.team.findFirst({
      where: buildTeamWhereQuery({
        teamId,
        userId: ctx.user.id,
        roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
      }),
      select: {
        id: true,
        organisationId: true,
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to this team.',
      });
    }

    const jobId = prefixedId('job_team_audit_logs_csv', 16);

    await jobs.triggerJob({
      id: jobId,
      name: EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID,
      payload: {
        jobId,
        teamId,
        dateRange,
        requestedByUserId: ctx.user.id,
        requestedByUserEmail: ctx.user.email,
        requestedByUserName: ctx.user.name,
        requestMetadata: ctx.metadata?.requestMetadata,
      },
    });

    return {
      jobId,
    };
  });

