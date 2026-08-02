import { reactivateResellerProfile } from '@documenso/lib/server-only/reseller/admin-reseller-actions';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZReactivateResellerProfileRequestSchema,
  ZReactivateResellerProfileResponseSchema,
} from './reactivate-reseller-profile.types';

export const reactivateResellerProfileRoute = adminProcedure
  .input(ZReactivateResellerProfileRequestSchema)
  .output(ZReactivateResellerProfileResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    await reactivateResellerProfile({
      applicationId,
    });

    return { success: true as const };
  });
