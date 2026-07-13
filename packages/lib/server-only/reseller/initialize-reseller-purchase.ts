import { ResellerPayoutMode, ResellerProfileStatus } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createTransaction } from '@documenso/lib/server-only/paystack';
import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';

import { getResellerPayoutReadiness } from './reseller-payout-readiness';
import { decryptResellerSecret } from './reseller-secrets';

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

  if (profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller is not currently accepting purchases',
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

  const payoutReadiness = getResellerPayoutReadiness(profile);

  if (!payoutReadiness.canAcceptPayments) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message:
        payoutReadiness.blockingReason ??
        'This reseller is not ready to accept payments right now',
    });
  }

  const availableCredits = await getOrganisationCredits(profile.organisationId);

  if (!profile.allowNegativeCredits && availableCredits < pkg.creditAmount) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller does not have enough credits to fulfill this purchase right now',
    });
  }

  const callbackUrl = `${NEXT_PUBLIC_WEBAPP_URL()}/r/${affiliateSlug}?purchase=success`;

  const metadata = {
    type: 'reseller-credit-purchase',
    payoutMode: profile.payoutMode,
    resellerProfileId: profile.id,
    purchaserOrganisationId,
    purchaserUserId,
    packageId: pkg.id,
    expectedAmount: pkg.priceInCents,
    creditAmount: pkg.creditAmount,
    ...(profile.payoutMode === ResellerPayoutMode.NOMIA_SUBACCOUNT && profile.paystackSubaccountCode
      ? { subaccountCode: profile.paystackSubaccountCode }
      : {}),
  };

  let transaction;

  if (profile.payoutMode === ResellerPayoutMode.OWN_PAYSTACK) {
    if (!profile.paystackSecretKey) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Reseller Paystack secret key is not configured',
      });
    }

    transaction = await createTransaction({
      email: purchaserEmail,
      amount: pkg.priceInCents,
      callback_url: callbackUrl,
      metadata,
      secretKey: decryptResellerSecret(profile.paystackSecretKey),
    });
  } else {
    if (!profile.paystackSubaccountCode) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Reseller payout subaccount is not configured',
      });
    }

    const platformFeePercent = Number(profile.platformFeePercent ?? 0);
    const transactionCharge =
      platformFeePercent > 0
        ? Math.round((pkg.priceInCents * platformFeePercent) / 100)
        : 0;

    transaction = await createTransaction({
      email: purchaserEmail,
      amount: pkg.priceInCents,
      callback_url: callbackUrl,
      metadata,
      subaccount: profile.paystackSubaccountCode,
      bearer: 'subaccount',
      ...(transactionCharge > 0 ? { transaction_charge: transactionCharge } : {}),
    });
  }

  if (!transaction.status || !transaction.data) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: transaction.message || 'Failed to initialize Paystack transaction',
    });
  }

  return {
    authorizationUrl: transaction.data.authorization_url,
    reference: transaction.data.reference,
    package: pkg,
    payoutMode: profile.payoutMode,
  };
};
