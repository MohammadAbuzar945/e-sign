import { verifyKbaByToken } from '@documenso/lib/server-only/document/kba/verify-kba-by-token';

import { procedure } from '../trpc';
import {
  ZAccessAuthVerifyKbaRequestSchema,
  ZAccessAuthVerifyKbaResponseSchema,
} from './access-auth-verify-kba.types';

export const accessAuthVerifyKbaRoute = procedure
  .input(ZAccessAuthVerifyKbaRequestSchema)
  .output(ZAccessAuthVerifyKbaResponseSchema)
  .mutation(async ({ input }) => {
    return await verifyKbaByToken({
      token: input.token,
      answer: input.answer,
    });
  });

