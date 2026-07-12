import { deleteReseller } from '@documenso/lib/server-only/reseller/admin-reseller-actions';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import { ZDeleteResellerRequestSchema, ZDeleteResellerResponseSchema } from './delete-reseller.types';

export const deleteResellerRoute = adminProcedure
  .input(ZDeleteResellerRequestSchema)
  .output(ZDeleteResellerResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    return await deleteReseller({
      applicationId,
    });
  });
