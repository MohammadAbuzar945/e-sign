import { z } from 'zod';

export const ZDownloadTeamAuditLogsRequestSchema = z.object({
  teamId: z.number().min(1),
});

export const ZDownloadTeamAuditLogsResponseSchema = z.object({
  data: z.string(),
  teamName: z.string(),
});

export type TDownloadTeamAuditLogsRequest = z.infer<
  typeof ZDownloadTeamAuditLogsRequestSchema
>;
export type TDownloadTeamAuditLogsResponse = z.infer<
  typeof ZDownloadTeamAuditLogsResponseSchema
>;

