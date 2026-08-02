import { assertResellerDemoExtrasAccess } from '@documenso/lib/constants/demo-feature-flags';
import { markResellerProfileDelinquent } from '@documenso/lib/server-only/reseller/admin-reseller-actions';

import { adminProcedure } from '../trpc';
import {
  ZMarkResellerDelinquentRequestSchema,
  ZMarkResellerDelinquentResponseSchema,
} from './mark-reseller-delinquent.types';

export const markResellerDelinquentRoute = adminProcedure
  .input(ZMarkResellerDelinquentRequestSchema)
  .output(ZMarkResellerDelinquentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const { applicationId } = input;

    await markResellerProfileDelinquent({
      applicationId,
    });

    return { success: true as const };
  });
