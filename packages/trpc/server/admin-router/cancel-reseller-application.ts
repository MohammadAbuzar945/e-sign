import { cancelResellerApplication } from '@documenso/lib/server-only/reseller/admin-reseller-actions';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZCancelResellerApplicationRequestSchema,
  ZCancelResellerApplicationResponseSchema,
} from './cancel-reseller-application.types';

export const cancelResellerApplicationRoute = adminProcedure
  .input(ZCancelResellerApplicationRequestSchema)
  .output(ZCancelResellerApplicationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId, cancellationReason } = input;

    await cancelResellerApplication({
      applicationId,
      cancellationReason,
    });

    return { success: true as const };
  });
