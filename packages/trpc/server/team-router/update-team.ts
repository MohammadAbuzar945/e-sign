import { updateTeam } from '@documenso/lib/server-only/team/update-team';
import { updateTeamPublicProfile } from '@documenso/lib/server-only/team/update-team-public-profile';

import { authenticatedProcedure } from '../trpc';
import { ZUpdateTeamRequestSchema, ZUpdateTeamResponseSchema } from './update-team.types';

export const updateTeamRoute = authenticatedProcedure
  //   .meta(updateTeamMeta)
  .input(ZUpdateTeamRequestSchema)
  .output(ZUpdateTeamResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { teamId, data } = input;

    const { name, url, isPrivate, profileBio, profileEnabled } = data;

    ctx.logger.info({
      input: {
        teamId,
      },
    });

    if (name || url || isPrivate !== undefined) {
      await updateTeam({
        userId: ctx.user.id,
        teamId,
        data: {
          name,
          url,
          isPrivate,
        },
        metadata: ctx.metadata,
      });
    }

    if (profileBio || profileEnabled !== undefined) {
      await updateTeamPublicProfile({
        userId: ctx.user.id,
        teamId,
        data: {
          bio: profileBio,
          enabled: profileEnabled,
        },
      });
    }
  });
