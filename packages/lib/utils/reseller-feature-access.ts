import { isResellerFeatureAllowedEmail } from '@documenso/lib/constants/esign-credit-packages';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';

export const RESELLER_FEATURE_ACCESS_DENIED_MESSAGE =
  'The reseller program is not available for your account.';

export const assertResellerFeatureAccess = (email: string | null | undefined) => {
  if (!email || !isResellerFeatureAllowedEmail(email)) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: RESELLER_FEATURE_ACCESS_DENIED_MESSAGE,
    });
  }
};
