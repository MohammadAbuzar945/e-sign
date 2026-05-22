import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

export const SEND_TEAM_AUDIT_LOGS_EXPORT_EMAIL_JOB_DEFINITION_ID =
  'send.team-audit-logs-export.email';

export const ZSendTeamAuditLogsExportEmailJobDefinitionSchema = z.object({
  teamId: z.number().min(1),
  teamName: z.string(),
  requestedByUserId: z.number().min(1),
  requestedByUserEmail: z.string().email(),
  requestedByUserName: z.string().nullable().optional(),
  downloadUrl: z.string().url(),
});

export type TSendTeamAuditLogsExportEmailJobDefinition = z.infer<
  typeof ZSendTeamAuditLogsExportEmailJobDefinitionSchema
>;

export const SEND_TEAM_AUDIT_LOGS_EXPORT_EMAIL_JOB_DEFINITION = {
  id: SEND_TEAM_AUDIT_LOGS_EXPORT_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Team Audit Logs Export Email',
  version: '1.0.0',
  trigger: {
    name: SEND_TEAM_AUDIT_LOGS_EXPORT_EMAIL_JOB_DEFINITION_ID,
    schema: ZSendTeamAuditLogsExportEmailJobDefinitionSchema,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-team-audit-logs-export-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_TEAM_AUDIT_LOGS_EXPORT_EMAIL_JOB_DEFINITION_ID,
  TSendTeamAuditLogsExportEmailJobDefinition
>;

