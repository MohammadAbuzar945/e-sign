import { z } from 'zod';

import { ZOrganisationSchema } from '@documenso/lib/types/organisation';
import { OrganisationMemberRole, TeamMemberRole } from '@documenso/prisma/generated/types';
import SubscriptionSchema from '@documenso/prisma/generated/zod/modelSchema/SubscriptionSchema';
import { TeamEmailSchema } from '@documenso/prisma/generated/zod/modelSchema/TeamEmailSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

export const ZGetOrganisationSessionResponseSchema = ZOrganisationSchema.extend({
  teams: z.array(
    TeamSchema.pick({
      id: true,
      name: true,
      url: true,
      createdAt: true,
      avatarImageId: true,
      organisationId: true,
    }).extend({
      isPrivate: z.boolean(),
      currentTeamRole: z.nativeEnum(TeamMemberRole),
      isTeamMember: z.boolean(),
      teamEmail: TeamEmailSchema.pick({ email: true }).nullable(),
      preferences: z.object({
        aiFeaturesEnabled: z.boolean(),
      }),
    }),
  ),
  subscription: SubscriptionSchema.nullable(),
  currentOrganisationRole: z.nativeEnum(OrganisationMemberRole),
  credits: z.number().optional().default(0),
}).array();

export type TGetOrganisationSessionResponse = z.infer<typeof ZGetOrganisationSessionResponseSchema>;

export type TeamSession = TGetOrganisationSessionResponse[number]['teams'][number];
export type OrganisationSession = TGetOrganisationSessionResponse[number];
