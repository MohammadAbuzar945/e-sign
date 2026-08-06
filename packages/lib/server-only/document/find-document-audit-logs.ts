import { type DocumentAuditLog, EnvelopeType, type Prisma } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { canViewEmailFailedAuditLogs } from '../../constants/email-failed-audit-log';
import { AppError, AppErrorCode } from '../../errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../types/document-audit-logs';
import type { FindResultResponse } from '../../types/search-params';
import { parseDocumentAuditLogData } from '../../utils/document-audit-logs';
import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface FindDocumentAuditLogsOptions {
  userId: number;
  teamId: number;
  documentId: number;
  /**
   * Viewer email used to gate EMAIL_FAILED audit logs.
   * When omitted, EMAIL_FAILED entries are hidden.
   */
  userEmail?: string | null;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: keyof DocumentAuditLog;
    direction: 'asc' | 'desc';
  };
  cursor?: string;
  filterForRecentActivity?: boolean;
}

export const findDocumentAuditLogs = async ({
  userId,
  teamId,
  documentId,
  userEmail,
  page = 1,
  perPage = 30,
  orderBy,
  cursor,
  filterForRecentActivity,
}: FindDocumentAuditLogsOptions) => {
  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';
  const canViewEmailFailed = canViewEmailFailedAuditLogs(userEmail);

  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'documentId',
      id: documentId,
    },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const envelope = await prisma.envelope.findUnique({
    where: envelopeWhereInput,
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: Prisma.DocumentAuditLogWhereInput = {
    envelopeId: envelope.id,
  };

  // Filter events down to what we consider recent activity.
  if (filterForRecentActivity) {
    const recentActivityTypes = [
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_DELETED,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_OPENED,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_COMPLETED,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_REJECTED,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_SENT,
      DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_MOVED_TO_TEAM,
      ...(canViewEmailFailed ? [DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED] : []),
    ];

    whereClause.OR = [
      {
        type: {
          in: recentActivityTypes,
        },
      },
      {
        type: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_SENT,
        data: {
          path: ['isResending'],
          equals: true,
        },
      },
    ];
  } else if (!canViewEmailFailed) {
    whereClause.type = {
      not: DOCUMENT_AUDIT_LOG_TYPE.EMAIL_FAILED,
    };
  }

  const [data, count] = await Promise.all([
    prisma.documentAuditLog.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage + 1,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      cursor: cursor ? { id: cursor } : undefined,
    }),
    prisma.documentAuditLog.count({
      where: whereClause,
    }),
  ]);

  let nextCursor: string | undefined = undefined;

  const parsedData = data.map((auditLog) => parseDocumentAuditLogData(auditLog));

  if (parsedData.length > perPage) {
    const nextItem = parsedData.pop();
    nextCursor = nextItem!.id;
  }

  return {
    data: parsedData,
    count,
    currentPage: Math.max(page, 1),
    perPage,
    totalPages: Math.ceil(count / perPage),
    nextCursor,
  } satisfies FindResultResponse<typeof parsedData> & { nextCursor?: string };
};
