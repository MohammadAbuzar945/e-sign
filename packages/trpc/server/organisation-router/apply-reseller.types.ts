import { z } from 'zod';

export const ZApplyResellerRequestSchema = z.object({
  organisationId: z.string(),
  variableValues: z.record(z.string(), z.string()).optional(),
});

export const ZApplyResellerResponseSchema = z.object({
  applicationId: z.string(),
  status: z.string(),
});
