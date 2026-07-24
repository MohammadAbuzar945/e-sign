import { assertResellerDemoExtrasAccess } from '@documenso/lib/constants/demo-feature-flags';
import { updateResellerAllowNegativeCredits } from '@documenso/lib/server-only/reseller/admin-reseller-actions';

import { adminProcedure } from '../trpc';
import {
  ZUpdateResellerAllowNegativeCreditsRequestSchema,
  ZUpdateResellerAllowNegativeCreditsResponseSchema,
} from './update-reseller-allow-negative-credits.types';

export const updateResellerAllowNegativeCreditsRoute = adminProcedure
  .input(ZUpdateResellerAllowNegativeCreditsRequestSchema)
  .output(ZUpdateResellerAllowNegativeCreditsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerDemoExtrasAccess(ctx.user.email);

    const { applicationId, allowNegativeCredits } = input;

    const profile = await updateResellerAllowNegativeCredits({
      applicationId,
      allowNegativeCredits,
    });

    return {
      success: true as const,
      allowNegativeCredits: profile.allowNegativeCredits,
    };
  });
