import { verifyDirectTemplateKbaByToken } from '@documenso/lib/server-only/template/kba/verify-direct-template-kba-by-token';

import { procedure } from '../trpc';
import {
  ZTemplateAccessAuthVerifyKbaRequestSchema,
  ZTemplateAccessAuthVerifyKbaResponseSchema,
} from './access-auth-verify-kba.types';

export const templateAccessAuthVerifyKbaRoute = procedure
  .input(ZTemplateAccessAuthVerifyKbaRequestSchema)
  .output(ZTemplateAccessAuthVerifyKbaResponseSchema)
  .mutation(async ({ input }) => {
    return await verifyDirectTemplateKbaByToken({
      token: input.token,
      answer: input.answer,
    });
  });
