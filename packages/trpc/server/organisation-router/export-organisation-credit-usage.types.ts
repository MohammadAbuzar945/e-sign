import { z } from 'zod';

export const ZExportOrganisationCreditUsageRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZExportOrganisationCreditUsageResponseSchema = z.object({
  organisationName: z.string(),
  count: z.number(),
  totalCredits: z.number(),
  data: z.array(
    z.object({
      id: z.string(),
      createdAt: z.date(),
      teamId: z.number(),
      teamName: z.string().nullable(),
      documentId: z.string(),
      credits: z.number(),
    }),
  ),
});

export type TExportOrganisationCreditUsageRequest = z.infer<
  typeof ZExportOrganisationCreditUsageRequestSchema
>;
export type TExportOrganisationCreditUsageResponse = z.infer<
  typeof ZExportOrganisationCreditUsageResponseSchema
>;
