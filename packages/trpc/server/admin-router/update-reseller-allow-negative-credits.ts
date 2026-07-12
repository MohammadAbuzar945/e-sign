import { updateResellerAllowNegativeCredits } from '@documenso/lib/server-only/reseller/admin-reseller-actions';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZUpdateResellerAllowNegativeCreditsRequestSchema,
  ZUpdateResellerAllowNegativeCreditsResponseSchema,
} from './update-reseller-allow-negative-credits.types';

export const updateResellerAllowNegativeCreditsRoute = adminProcedure
  .input(ZUpdateResellerAllowNegativeCreditsRequestSchema)
  .output(ZUpdateResellerAllowNegativeCreditsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

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
