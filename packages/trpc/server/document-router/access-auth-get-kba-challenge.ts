import { getKbaChallengeByToken } from '@documenso/lib/server-only/document/kba/get-kba-challenge-by-token';

import { procedure } from '../trpc';
import {
  ZAccessAuthGetKbaChallengeRequestSchema,
  ZAccessAuthGetKbaChallengeResponseSchema,
} from './access-auth-get-kba-challenge.types';

export const accessAuthGetKbaChallengeRoute = procedure
  .input(ZAccessAuthGetKbaChallengeRequestSchema)
  .output(ZAccessAuthGetKbaChallengeResponseSchema)
  .query(async ({ input }) => {
    return await getKbaChallengeByToken({
      token: input.token,
    });
  });

