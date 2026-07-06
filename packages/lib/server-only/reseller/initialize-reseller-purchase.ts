import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

export type InitializeResellerPurchaseOptions = {
  affiliateSlug: string;
  packageId: string;
  purchaserOrganisationId: string;
  purchaserUserId: number;
  purchaserEmail: string;
};

export const initializeResellerPurchase = async ({
  affiliateSlug,
  packageId,
  purchaserOrganisationId,
  purchaserUserId,
  purchaserEmail,
}: InitializeResellerPurchaseOptions) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { affiliateSlug },
    include: {
      packages: true,
      organisation: true,
    },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller not found',
    });
  }

  const pkg = profile.packages.find((item) => item.id === packageId && item.isEnabled);

  if (!pkg) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Package is not available for purchase',
    });
  }

  if (profile.organisationId === purchaserOrganisationId) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'You cannot purchase credits from your own reseller account',
    });
  }

  const availableCredits = await getOrganisationCredits(profile.organisationId);

  if (!profile.allowNegativeCredits && availableCredits < pkg.creditAmount) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller does not currently have enough credits available for this purchase',
    });
  }

  const callbackUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}?purchase=success`;

  const transaction = await createTransaction({
    email: purchaserEmail,
    amount: pkg.priceInCents,
    callback_url: callbackUrl,
    metadata: {
      type: 'reseller-credit-purchase',
      resellerProfileId: profile.id,
      purchaserOrganisationId,
      purchaserUserId,
      packageId: pkg.id,
      expectedAmount: pkg.priceInCents,
      creditAmount: pkg.creditAmount,
    },
  });

  if (!transaction.status || !transaction.data) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: transaction.message || 'Failed to initialize Paystack transaction',
    });
  }

  return {
    authorizationUrl: transaction.data.authorization_url,
    reference: transaction.data.reference,
    package: pkg,
  };
};
