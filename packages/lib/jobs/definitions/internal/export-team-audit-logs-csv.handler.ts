import { BackgroundJobStatus, DocumentDataType } from '@prisma/client';
import { i18n } from '@lingui/core';

import { ZSupportedLanguageCodeSchema } from '../../../constants/i18n';
import { getTranslations } from '../../../utils/i18n';
import { parseTeamAuditLogData, formatTeamAuditLogAction } from '../../../utils/team-audit-logs';
import { prisma } from '@documenso/prisma';

import { putFileServerSide } from '../../../universal/upload/put-file.server';
import { getPresignGetUrl } from '../../../universal/upload/server-actions';
import { env } from '../../../utils/env';
import { jobs } from '../../client';
import type { JobRunIO } from '../../client/_internal/job';
import type {
  TExportTeamAuditLogsCsvJobDefinition,
  TTeamAuditLogExportDateRange,
} from './export-team-audit-logs-csv';

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function getFromDateForDateRange(dateRange: TTeamAuditLogExportDateRange): Date {
  const now = Date.now();
  switch (dateRange) {
    case '1_WEEK':
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case '30_DAYS':
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case '90_DAYS':
      return new Date(now - 90 * 24 * 60 * 60 * 1000);
    case 'ALL_TIME':
      return new Date(now - ONE_YEAR_MS);
    default:
      return new Date(now - ONE_YEAR_MS);
  }
}

type ExportResult = {
  filename: string;
  contentType: 'text/csv';
  recordCount: number;
  storage: {
    type: DocumentDataType;
    data: string;
  };
};

const toCsvCell = (value: unknown) => {
  if (value === null || value === undefined) {
    return '';
  }

  const str =
    value instanceof Date ? value.toISOString() : typeof value === 'string' ? value : String(value);

  const escaped = str.replaceAll('"', '""');
  const needsQuotes = /[",\n\r]/.test(escaped);

  return needsQuotes ? `"${escaped}"` : escaped;
};

const toCsvRow = (cells: unknown[]) => {
  return `${cells.map(toCsvCell).join(',')}\n`;
};

const safeFileName = (name: string) => {
  // Keep it simple and cross-platform safe.
  return name.replaceAll(/[<>:"/\\|?*\u0000-\u001F]/g, '-').trim();
};

export const run = async ({
  payload,
  io,
}: {
  payload: TExportTeamAuditLogsCsvJobDefinition;
  io: JobRunIO;
}) => {
  const {
    jobId,
    teamId,
    dateRange,
    requestedByUserId,
    requestedByUserEmail,
    requestedByUserName,
  } = payload;

  const fromDate = getFromDateForDateRange(dateRange);

  try {
    await prisma.backgroundJob
      .update({
        where: {
          id: jobId,
        },
        data: {
          status: BackgroundJobStatus.PROCESSING,
        },
      })
      .catch(() => null);

    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
      },
      select: {
        name: true,
        organisationId: true,
      },
    });

    if (!team) {
      throw new Error('Team not found');
    }

    const language = ZSupportedLanguageCodeSchema.parse(payload.language ?? 'en');

    const messages = await getTranslations(language);

    i18n.loadAndActivate({
      locale: language,
      messages,
    });

    const csvParts: string[] = [];
    csvParts.push(
      toCsvRow([
        'createdAt',
        'type',
        'actorName',
        'actorEmail',
        'ipAddress',
        'description',
      ]),
    );

    let recordCount = 0;
    let cursor: string | undefined = undefined;

    while (true) {
      const batch = (await (prisma as any).teamAuditLog.findMany({
        where: {
          teamId,
          createdAt: { gte: fromDate },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: 1000,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        select: {
          id: true,
          teamId: true,
          createdAt: true,
          type: true,
          name: true,
          email: true,
          userId: true,
          ipAddress: true,
          userAgent: true,
          data: true,
        },
      })) as Array<{
        id: string;
        teamId: number;
        createdAt: Date;
        type: string;
        name: string | null;
        email: string | null;
        userId: number | null;
        ipAddress: string | null;
        userAgent: string | null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any;
      }>;

      if (!batch || batch.length === 0) {
        break;
      }

      for (const row of batch) {
        const parsed = parseTeamAuditLogData({
          ...row,
        });

        // For CSV exports, always show the actual actor (never "You").
        const formatted = formatTeamAuditLogAction(i18n, parsed);

        recordCount += 1;
        csvParts.push(
          toCsvRow([
            row.createdAt,
            row.type,
            row.name,
            row.email,
            row.ipAddress,
            formatted.description,
          ]),
        );
      }

      cursor = batch[batch.length - 1]?.id;
    }

    const csv = csvParts.join('');
    const bytes = new TextEncoder().encode(csv);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

    const date = new Date().toISOString().slice(0, 10);
    const filename = safeFileName(`${team.name} - Team Audit Logs (${date}).csv`);

    const stored = await putFileServerSide({
      name: filename,
      type: 'text/csv',
      arrayBuffer: async () => Promise.resolve(arrayBuffer),
    });

    const result: ExportResult = {
      filename,
      contentType: 'text/csv',
      recordCount,
      storage: stored,
    };

    const uploadTransport = env('NEXT_PUBLIC_UPLOAD_TRANSPORT');

    let downloadUrl: string | null = null;

    if (
      result.storage.type === DocumentDataType.S3_PATH &&
      (uploadTransport === 's3' || uploadTransport === 'gcs')
    ) {
      const { url } = await getPresignGetUrl(result.storage.data);
      downloadUrl = url;
    }

    await prisma.backgroundJob
      .update({
        where: {
          id: jobId,
        },
        data: {
          status: BackgroundJobStatus.COMPLETED,
          completedAt: new Date(),
          payload: {
            ...(payload as unknown as Record<string, unknown>),
            result,
          },
        },
      })
      .catch(() => null);

    if (downloadUrl) {
      await io.triggerJob('send-team-audit-logs-export-email', {
        name: 'send.team-audit-logs-export.email',
        payload: {
          teamId,
          teamName: team.name,
          requestedByUserId,
          requestedByUserEmail,
          requestedByUserName,
          downloadUrl,
        },
      });
    }
  } catch (error) {
    io.logger.error('Failed to export team audit logs CSV', error);

    await prisma.backgroundJob
      .update({
        where: {
          id: jobId,
        },
        data: {
          status: BackgroundJobStatus.FAILED,
          completedAt: new Date(),
          payload: {
            ...(payload as unknown as Record<string, unknown>),
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        },
      })
      .catch(() => null);

    throw error;
  }
};

