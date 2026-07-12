import { deactivateResellerProfile } from '@documenso/lib/server-only/reseller/admin-reseller-actions';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZDeactivateResellerProfileRequestSchema,
  ZDeactivateResellerProfileResponseSchema,
} from './deactivate-reseller-profile.types';

export const deactivateResellerProfileRoute = adminProcedure
  .input(ZDeactivateResellerProfileRequestSchema)
  .output(ZDeactivateResellerProfileResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    await deactivateResellerProfile({
      applicationId,
    });

    return { success: true as const };
  });
