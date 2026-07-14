import {
  adminRefreshResellerBankAccountStatus,
  adminRetryResellerSubaccount,
  adminVerifyResellerBankAccount,
} from '@documenso/lib/server-only/reseller/admin-verify-reseller-bank';
import { assertResellerFeatureAccess } from '@documenso/lib/utils/reseller-feature-access';

import { adminProcedure } from '../trpc';
import {
  ZAdminRefreshResellerBankAccountStatusRequestSchema,
  ZAdminRefreshResellerBankAccountStatusResponseSchema,
  ZAdminRetryResellerSubaccountRequestSchema,
  ZAdminRetryResellerSubaccountResponseSchema,
  ZAdminVerifyResellerBankAccountRequestSchema,
  ZAdminVerifyResellerBankAccountResponseSchema,
} from './verify-reseller-bank-account.types';

export const verifyResellerBankAccountRoute = adminProcedure
  .input(ZAdminVerifyResellerBankAccountRequestSchema)
  .output(ZAdminVerifyResellerBankAccountResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    const result = await adminVerifyResellerBankAccount({
      applicationId,
    });

    return {
      success: true as const,
      ...result,
    };
  });

export const refreshResellerBankAccountStatusRoute = adminProcedure
  .input(ZAdminRefreshResellerBankAccountStatusRequestSchema)
  .output(ZAdminRefreshResellerBankAccountStatusResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    const result = await adminRefreshResellerBankAccountStatus({
      applicationId,
    });

    return {
      success: true as const,
      ...result,
    };
  });

export const retryResellerSubaccountRoute = adminProcedure
  .input(ZAdminRetryResellerSubaccountRequestSchema)
  .output(ZAdminRetryResellerSubaccountResponseSchema)
  .mutation(async ({ input, ctx }) => {
    assertResellerFeatureAccess(ctx.user.email);

    const { applicationId } = input;

    const result = await adminRetryResellerSubaccount({
      applicationId,
    });

    return {
      success: true as const,
      ...result,
    };
  });
