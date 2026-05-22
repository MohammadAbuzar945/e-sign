import { z } from 'zod';

import {
  ZTeamAuditLogExportDateRangeSchema,
  type TTeamAuditLogExportDateRange,
} from '@documenso/lib/jobs/definitions/internal/export-team-audit-logs-csv';

export type { TTeamAuditLogExportDateRange };

export const ZExportTeamAuditLogsCsvRequestSchema = z.object({
  teamId: z.number().min(1),
  dateRange: ZTeamAuditLogExportDateRangeSchema,
});

export const ZExportTeamAuditLogsCsvResponseSchema = z.object({
  jobId: z.string().min(1),
});

export type TExportTeamAuditLogsCsvRequest = z.infer<typeof ZExportTeamAuditLogsCsvRequestSchema>;
export type TExportTeamAuditLogsCsvResponse = z.infer<typeof ZExportTeamAuditLogsCsvResponseSchema>;

