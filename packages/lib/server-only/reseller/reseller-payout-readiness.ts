import type {
  ResellerPayoutMode,
  ResellerSubaccountStatus,
} from '@prisma/client';

export type ResellerPayoutReadinessInput = {
  payoutMode: ResellerPayoutMode;
  paystackPublicKey: string | null;
  paystackSecretKey: string | null;
  paystackSubaccountCode: string | null;
  subaccountStatus: ResellerSubaccountStatus | null;
};

export type ResellerPayoutReadiness = {
  mode: ResellerPayoutMode;
  canAcceptPayments: boolean;
  hasOwnPaystackConfigured: boolean;
  hasNomiaSubaccountConfigured: boolean;
  blockingReason?: string;
};

export const getResellerPayoutReadiness = (
  profile: ResellerPayoutReadinessInput,
): ResellerPayoutReadiness => {
  const hasOwnPaystackConfigured = Boolean(
    profile.paystackPublicKey?.trim() && profile.paystackSecretKey?.trim(),
  );
  const hasNomiaSubaccountConfigured =
    profile.subaccountStatus === 'ACTIVE' && Boolean(profile.paystackSubaccountCode?.trim());

  if (profile.payoutMode === 'OWN_PAYSTACK') {
    if (!hasOwnPaystackConfigured) {
      return {
        mode: profile.payoutMode,
        canAcceptPayments: false,
        hasOwnPaystackConfigured,
        hasNomiaSubaccountConfigured,
        blockingReason: 'Paystack public and secret keys are required',
      };
    }

    return {
      mode: profile.payoutMode,
      canAcceptPayments: true,
      hasOwnPaystackConfigured,
      hasNomiaSubaccountConfigured,
    };
  }

  if (!hasNomiaSubaccountConfigured) {
    return {
      mode: profile.payoutMode,
      canAcceptPayments: false,
      hasOwnPaystackConfigured,
      hasNomiaSubaccountConfigured,
      blockingReason:
        profile.subaccountStatus === 'FAILED'
          ? 'Bank account verification failed'
          : profile.subaccountStatus === 'PENDING'
            ? profile.paystackSubaccountCode
              ? 'Bank account verification is still pending'
              : 'Awaiting Nomia bank verification'
            : 'Bank details are required for Nomia payouts',
    };
  }

  return {
    mode: profile.payoutMode,
    canAcceptPayments: true,
    hasOwnPaystackConfigured,
    hasNomiaSubaccountConfigured,
  };
};
