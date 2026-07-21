import { z } from 'zod';

import { ZResellerTermsVariableValuesSchema } from './reseller-applications.types';

export const ZGetResellerApplicationRequestSchema = z.object({
  applicationId: z.string().min(1),
});

export const ZGetResellerApplicationResponseSchema = z.object({
  id: z.string(),
  snapshotOrgName: z.string(),
  snapshotApplicantName: z.string(),
  snapshotApplicantEmail: z.string(),
  termsVariableValues: ZResellerTermsVariableValuesSchema.nullable(),
});

export type TGetResellerApplicationResponse = z.infer<typeof ZGetResellerApplicationResponseSchema>;
