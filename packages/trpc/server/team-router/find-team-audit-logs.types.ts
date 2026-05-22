import { z } from 'zod';

import {
  ZTeamAuditLogSchema,
  ZTeamAuditLogTypeSchema,
} from '@documenso/lib/types/team-audit-logs';
import {
  ZFindResultResponse,
  ZFindSearchParamsSchema,
} from '@documenso/lib/types/search-params';

export const ZFindTeamAuditLogsRequestSchema = ZFindSearchParamsSchema.extend({
  teamId: z.number().min(1),
  cursor: z.string().optional(),
  types: ZTeamAuditLogTypeSchema.array().optional(),
  orderByColumn: z.enum(['createdAt', 'type']).optional(),
  orderByDirection: z.enum(['asc', 'desc']).default('desc'),
});

export const ZFindTeamAuditLogsResponseSchema = ZFindResultResponse.extend({
  data: ZTeamAuditLogSchema.array(),
  nextCursor: z.string().optional(),
});

export type TFindTeamAuditLogsRequest = z.infer<typeof ZFindTeamAuditLogsRequestSchema>;
export type TFindTeamAuditLogsResponse = z.infer<typeof ZFindTeamAuditLogsResponseSchema>;

