import { getDirectTemplateKbaChallengeByToken } from '@documenso/lib/server-only/template/kba/get-direct-template-kba-challenge-by-token';

import { procedure } from '../trpc';
import {
  ZTemplateAccessAuthGetKbaChallengeRequestSchema,
  ZTemplateAccessAuthGetKbaChallengeResponseSchema,
} from './access-auth-get-kba-challenge.types';

export const templateAccessAuthGetKbaChallengeRoute = procedure
  .input(ZTemplateAccessAuthGetKbaChallengeRequestSchema)
  .output(ZTemplateAccessAuthGetKbaChallengeResponseSchema)
  .query(async ({ input }) => {
    return await getDirectTemplateKbaChallengeByToken({
      token: input.token,
    });
  });
