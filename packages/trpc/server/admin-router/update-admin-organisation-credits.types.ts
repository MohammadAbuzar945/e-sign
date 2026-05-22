import { z } from 'zod';

export const ZUpdateAdminOrganisationCreditsRequestSchema = z.object({
  organisationId: z.string(),
  credits: z.number().int().min(0),
});

export const ZUpdateAdminOrganisationCreditsResponseSchema = z.void();

export type TUpdateAdminOrganisationCreditsRequest = z.infer<
  typeof ZUpdateAdminOrganisationCreditsRequestSchema
>;
export type TUpdateAdminOrganisationCreditsResponse = z.infer<
  typeof ZUpdateAdminOrganisationCreditsResponseSchema
>;
