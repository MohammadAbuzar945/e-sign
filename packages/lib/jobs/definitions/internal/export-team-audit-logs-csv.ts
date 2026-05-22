import { z } from 'zod';

import {
  TEAM_AUDIT_LOG_EXPORT_DATE_RANGES,
  type TTeamAuditLogExportDateRange,
} from '../../../constants/team-audit-logs';
import { SUPPORTED_LANGUAGE_CODES } from '../../../constants/i18n';
import { ZRequestMetadataSchema } from '../../../universal/extract-request-metadata';
import type { JobDefinition } from '../../client/_internal/job';

export const EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID = 'internal.export-team-audit-logs.csv';

export { TEAM_AUDIT_LOG_EXPORT_DATE_RANGES, type TTeamAuditLogExportDateRange };

export const ZTeamAuditLogExportDateRangeSchema = z.enum(TEAM_AUDIT_LOG_EXPORT_DATE_RANGES);

export const ZExportTeamAuditLogsCsvJobDefinitionSchema = z.object({
  jobId: z.string().min(1),
  teamId: z.number().min(1),
  dateRange: ZTeamAuditLogExportDateRangeSchema,
  requestedByUserId: z.number().min(1),
  requestedByUserEmail: z.string().email(),
  requestedByUserName: z.string().nullable().optional(),
  language: z.enum(SUPPORTED_LANGUAGE_CODES).optional(),
  requestMetadata: ZRequestMetadataSchema.optional(),
});

export type TExportTeamAuditLogsCsvJobDefinition = z.infer<
  typeof ZExportTeamAuditLogsCsvJobDefinitionSchema
>;

export const EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION = {
  id: EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID,
  name: 'Export Team Audit Logs (CSV)',
  version: '1.0.0',
  optimizeParallelism: false,
  trigger: {
    name: EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID,
    schema: ZExportTeamAuditLogsCsvJobDefinitionSchema,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./export-team-audit-logs-csv.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof EXPORT_TEAM_AUDIT_LOGS_CSV_JOB_DEFINITION_ID,
  TExportTeamAuditLogsCsvJobDefinition
>;

