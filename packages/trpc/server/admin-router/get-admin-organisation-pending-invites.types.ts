import { z } from 'zod';

export const ZGetAdminOrganisationPendingInvitesRequestSchema = z.object({
  organisationId: z.string(),
});

export const ZGetAdminOrganisationPendingInvitesResponseSchema = z.object({
  invites: z.array(
    z.object({
      id: z.string(),
      email: z.string(),
      organisationRole: z.string(),
      createdAt: z.date(),
    }),
  ),
});

export type TGetAdminOrganisationPendingInvitesRequest = z.infer<
  typeof ZGetAdminOrganisationPendingInvitesRequestSchema
>;
export type TGetAdminOrganisationPendingInvitesResponse = z.infer<
  typeof ZGetAdminOrganisationPendingInvitesResponseSchema
>;
