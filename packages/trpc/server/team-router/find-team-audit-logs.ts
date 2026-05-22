import { findTeamAuditLogs } from '@documenso/lib/server-only/team/find-team-audit-logs';

import { authenticatedProcedure } from '../trpc';
import {
  ZFindTeamAuditLogsRequestSchema,
  ZFindTeamAuditLogsResponseSchema,
} from './find-team-audit-logs.types';

export const findTeamAuditLogsRoute = authenticatedProcedure
  .input(ZFindTeamAuditLogsRequestSchema)
  .output(ZFindTeamAuditLogsResponseSchema)
  .query(async ({ input, ctx }) => {
    const {
      page,
      perPage,
      teamId,
      cursor,
      types,
      orderByColumn,
      orderByDirection,
    } = input;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    return await findTeamAuditLogs({
      userId: ctx.user.id,
      teamId,
      page,
      perPage,
      cursor,
      types,
      orderBy: orderByColumn ? { column: orderByColumn, direction: orderByDirection } : undefined,
    });
  });

