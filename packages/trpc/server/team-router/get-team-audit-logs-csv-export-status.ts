import { BackgroundJobStatus, DocumentDataType } from '@prisma/client';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/teams';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { buildTeamWhereQuery } from '@documenso/lib/utils/teams';
import { env } from '@documenso/lib/utils/env';
import { getPresignGetUrl } from '@documenso/lib/universal/upload/server-actions';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID } from '@documenso/lib/jobs/definitions/internal/export-team-audit-logs-csv';
import {
  ZGetTeamAuditLogsCsvExportStatusRequestSchema,
  ZGetTeamAuditLogsCsvExportStatusResponseSchema,
} from './get-team-audit-logs-csv-export-status.types';

type ExportResult = {
  filename: string;
  contentType: string;
  recordCount: number;
  storage: {
    type: DocumentDataType;
    data: string;
  };
};

export const getTeamAuditLogsCsvExportStatusRoute = authenticatedProcedure
  .input(ZGetTeamAuditLogsCsvExportStatusRequestSchema)
  .output(ZGetTeamAuditLogsCsvExportStatusResponseSchema)
  .query(async ({ input, ctx }) => {
    const { teamId, jobId } = input;

    ctx.logger.info({
      input: {
        teamId,
        jobId,
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
      },
    });

    if (!team) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You do not have access to this team.',
      });
    }

    const backgroundJob = await prisma.backgroundJob.findFirst({
      where: {
        id: jobId,
        jobId: EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID,
      },
    });

    if (!backgroundJob) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const payload = (backgroundJob.payload ?? {}) as Record<string, unknown>;
    const payloadTeamId = typeof payload.teamId === 'number' ? payload.teamId : null;

    if (payloadTeamId !== teamId) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const error = typeof payload.error === 'string' ? payload.error : null;
    const result = (payload.result ?? null) as ExportResult | null;

    const filename = result?.filename ?? null;

    const uploadTransport = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

    const download =
      backgroundJob.status === BackgroundJobStatus.COMPLETED && result
        ? await (async () => {
            if (
              result.storage.type === DocumentDataType.S3_PATH &&
              (uploadTransport === 's3' || uploadTransport === 'gcs')
            ) {
              const { url } = await getPresignGetUrl(result.storage.data);

              return {
                kind: 'url' as const,
                url,
              };
            }

            if (result.storage.type === DocumentDataType.BYTES_64) {
              return {
                kind: 'base64' as const,
                data: result.storage.data,
              };
            }

            return null;
          })()
        : null;

    return {
      status: backgroundJob.status,
      filename,
      error,
      download,
    };
  });

