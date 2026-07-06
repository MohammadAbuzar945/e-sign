import { findResellerApplications } from '@documenso/lib/server-only/reseller/find-reseller-applications';
import {
  rejectResellerApplication,
} from '@documenso/lib/server-only/reseller/process-reseller-paystack-webhook';
import { sendResellerTerms } from '@documenso/lib/server-only/reseller/send-reseller-terms';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZFindResellerApplicationsRequestSchema,
  ZFindResellerApplicationsResponseSchema,
  ZRejectResellerApplicationRequestSchema,
  ZRejectResellerApplicationResponseSchema,
  ZSendResellerTermsRequestSchema,
  ZSendResellerTermsResponseSchema,
} from './reseller-applications.types';

export const findResellerApplicationsRoute = adminProcedure
  .input(ZFindResellerApplicationsRequestSchema)
  .output(ZFindResellerApplicationsResponseSchema)
  .query(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { query, page, perPage, status } = input;

    return await findResellerApplications({
      query,
      page,
      perPage,
      status,
    });
  });

export const sendResellerTermsRoute = adminProcedure
  .input(ZSendResellerTermsRequestSchema)
  .output(ZSendResellerTermsResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const results = await sendResellerTerms({
      applications: input.applications,
      requestMetadata: ctx.metadata,
    });

    return {
      sentCount: results.length,
    };
  });

export const rejectResellerApplicationRoute = adminProcedure
  .input(ZRejectResellerApplicationRequestSchema)
  .output(ZRejectResellerApplicationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    await rejectResellerApplication({
      applicationId: input.applicationId,
      rejectionReason: input.rejectionReason,
    });

    return { success: true as const };
  });
