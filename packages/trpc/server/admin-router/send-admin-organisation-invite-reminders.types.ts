import { z } from 'zod';

export const ZSendAdminOrganisationInviteRemindersRequestSchema = z.object({
  organisationId: z.string(),
  /**
   * Omit to remind every pending invite in the organisation.
   */
  invitationIds: z.array(z.string()).optional(),
});

export const ZSendAdminOrganisationInviteRemindersResponseSchema = z.object({
  sentCount: z.number(),
  failedCount: z.number(),
});

export type TSendAdminOrganisationInviteRemindersRequest = z.infer<
  typeof ZSendAdminOrganisationInviteRemindersRequestSchema
>;
export type TSendAdminOrganisationInviteRemindersResponse = z.infer<
  typeof ZSendAdminOrganisationInviteRemindersResponseSchema
>;
