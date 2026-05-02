import { z } from 'zod';

import { ZDocumentKbaSettingsSchema } from '@documenso/lib/types/document-auth';
import { TeamMemberRole } from '@documenso/prisma/generated/types';
import OrganisationGlobalSettingsSchema from '@documenso/prisma/generated/zod/modelSchema/OrganisationGlobalSettingsSchema';
import TeamGlobalSettingsSchema from '@documenso/prisma/generated/zod/modelSchema/TeamGlobalSettingsSchema';
import TeamSchema from '@documenso/prisma/generated/zod/modelSchema/TeamSchema';

// export const getTeamMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'GET',
//     path: '/team/{teamReference}',
//     summary: 'Get team',
//     description: 'Get a team by ID or URL',
//     tags: ['team'],
//   },
// };

export const ZGetTeamRequestSchema = z.object({
  teamReference: z.union([z.string(), z.number()]),
});

export const ZGetTeamResponseSchema = TeamSchema.pick({
  id: true,
  name: true,
  url: true,
  createdAt: true,
  avatarImageId: true,
  organisationId: true,
}).extend({
  currentTeamRole: z.nativeEnum(TeamMemberRole),
  teamSettings: TeamGlobalSettingsSchema.omit({
    id: true,
  }),
  derivedSettings: OrganisationGlobalSettingsSchema.omit({
    id: true,
  }),
  organisationKbaSettings: ZDocumentKbaSettingsSchema,
});

export type TGetTeamResponse = z.infer<typeof ZGetTeamResponseSchema>;
