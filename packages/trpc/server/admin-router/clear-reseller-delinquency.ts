import { assertResellerDemoExtrasAccess } from '@documenso/lib/constants/demo-feature-flags';
import { clearResellerProfileDelinquency } from '@documenso/lib/server-only/reseller/admin-reseller-actions';

import { adminProcedure } from '../trpc';
import {
  ZClearResellerDelinquencyRequestSchema,
  ZClearResellerDelinquencyResponseSchema,
} from './clear-reseller-delinquency.types';

export const clearResellerDelinquencyRoute = adminProcedure
  .input(ZClearResellerDelinquencyRequestSchema)
  .output(ZClearResellerDelinquencyResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const { applicationId } = input;

    await clearResellerProfileDelinquency({
      applicationId,
    });

    return { success: true as const };
  });
