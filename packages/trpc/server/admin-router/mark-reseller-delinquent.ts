import { markResellerProfileDelinquent } from '@documenso/lib/server-only/reseller/admin-reseller-actions';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZMarkResellerDelinquentRequestSchema,
  ZMarkResellerDelinquentResponseSchema,
} from './mark-reseller-delinquent.types';

export const markResellerDelinquentRoute = adminProcedure
  .input(ZMarkResellerDelinquentRequestSchema)
  .output(ZMarkResellerDelinquentResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    await markResellerProfileDelinquent({
      applicationId,
    });

    return { success: true as const };
  });
