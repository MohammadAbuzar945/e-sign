import { z } from 'zod';
import { ZTeamNameSchema, ZTeamUrlSchema } from './schema';

// export const createTeamMeta: TrpcOpenApiMeta = {
//   openapi: {
//     method: 'POST',
//     path: '/team/create',
//     summary: 'Create team',
//     description: 'Create a new team',
//     tags: ['Team'],
//   },
// };

export const ZCreateTeamRequestBaseSchema = z.object({
  organisationId: z.string(),
  teamName: ZTeamNameSchema,
  teamUrl: ZTeamUrlSchema,
  inheritMembers: z
    .boolean()
    .describe(
      'Whether to automatically assign all current and future organisation members to the new team. Defaults to true.',
    ),
  isPrivate: z
    .boolean()
    .describe('Whether only members of the team can see documents belonging to this team. Defaults to false.'),
  organisationMemberId: z
    .string()
    .optional()
    .describe('ID of the organisation member who will be added as the initial team admin for a private team.'),
});

export const ZCreateTeamRequestSchema = ZCreateTeamRequestBaseSchema.superRefine((value, ctx) => {
  if (value.isPrivate && !value.organisationMemberId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organisationMemberId'],
      message: 'Organisation member is required for private teams.',
    });
  }
});

export const ZCreateTeamResponseSchema = z.void();

export type TCreateTeamRequest = z.infer<typeof ZCreateTeamRequestSchema>;
