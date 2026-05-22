import { BackgroundJobStatus } from '@prisma/client';
import { z } from 'zod';

export const ZGetTeamAuditLogsCsvExportStatusRequestSchema = z.object({
  teamId: z.number().min(1),
  jobId: z.string().min(1),
});

export const ZGetTeamAuditLogsCsvExportStatusResponseSchema = z.object({
  status: z.nativeEnum(BackgroundJobStatus),
  filename: z.string().nullable(),
  error: z.string().nullable(),
  download: z
    .union([
      z.object({
        kind: z.literal('url'),
        url: z.string().url(),
      }),
      z.object({
        kind: z.literal('base64'),
        data: z.string(),
      }),
    ])
    .nullable(),
});

export type TGetTeamAuditLogsCsvExportStatusRequest = z.infer<
  typeof ZGetTeamAuditLogsCsvExportStatusRequestSchema
>;
export type TGetTeamAuditLogsCsvExportStatusResponse = z.infer<
  typeof ZGetTeamAuditLogsCsvExportStatusResponseSchema
>;

