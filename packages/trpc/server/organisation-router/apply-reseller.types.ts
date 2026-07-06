import { z } from 'zod';

export const ZApplyResellerRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZApplyResellerResponseSchema = z.object({
  applicationId: z.string(),
  status: z.string(),
});
