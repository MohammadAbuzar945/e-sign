import { prisma } from '@documenso/prisma';

import { TEAM_MEMBER_ROLE_PERMISSIONS_MAP } from '../../constants/teams';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { FindResultResponse } from '../../types/search-params';
import { parseTeamAuditLogData } from '../../utils/team-audit-logs';
import { buildTeamWhereQuery } from '../../utils/teams';

export interface FindTeamAuditLogsOptions {
  userId: number;
  teamId: number;
  page?: number;
  perPage?: number;
  orderBy?: {
    column: 'createdAt' | 'type';
    direction: 'asc' | 'desc';
  };
  cursor?: string;
  types?: string[];
}

export const findTeamAuditLogs = async ({
  userId,
  teamId,
  page = 1,
  perPage = 30,
  orderBy,
  cursor,
  types,
}: FindTeamAuditLogsOptions) => {
  const orderByColumn = orderBy?.column ?? 'createdAt';
  const orderByDirection = orderBy?.direction ?? 'desc';

  const team = await prisma.team.findFirst({
    where: buildTeamWhereQuery({
      teamId,
      userId,
      roles: TEAM_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_TEAM'],
    }),
    select: {
      id: true,
    },
  });

  if (!team) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  const whereClause: { teamId: number; type?: { in: string[] } } = {
    teamId: team.id,
  };

  if (types && types.length > 0) {
    whereClause.type = {
      in: types,
    };
  }

  const [data, count] = await Promise.all([
    (prisma as any).teamAuditLog.findMany({
      where: whereClause,
      skip: Math.max(page - 1, 0) * perPage,
      take: perPage + 1,
      orderBy: {
        [orderByColumn]: orderByDirection,
      },
      cursor: cursor ? { id: cursor } : undefined,
    }),
    (prisma as any).teamAuditLog.count({
      where: whereClause,
    }),
  ]);

  let nextCursor: string | undefined = undefined;

  const parsedData = data.map((auditLog: unknown) => parseTeamAuditLogData(auditLog as any));

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

