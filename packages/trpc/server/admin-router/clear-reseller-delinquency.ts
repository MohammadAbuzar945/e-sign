import { clearResellerProfileDelinquency } from '@documenso/lib/server-only/reseller/admin-reseller-actions';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZClearResellerDelinquencyRequestSchema,
  ZClearResellerDelinquencyResponseSchema,
} from './clear-reseller-delinquency.types';

export const clearResellerDelinquencyRoute = adminProcedure
  .input(ZClearResellerDelinquencyRequestSchema)
  .output(ZClearResellerDelinquencyResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    await clearResellerProfileDelinquency({
      applicationId,
    });

    return { success: true as const };
  });
