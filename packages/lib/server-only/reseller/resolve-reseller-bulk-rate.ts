import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export type ResellerBulkRateTierLike = {
  minCredits: number;
  pricePerCreditCents: number;
  isEnabled: boolean;
};

export type ResolvedResellerBulkRate = {
  credits: number;
  ratePerCreditCents: number;
  amountInCents: number;
  minCreditsMatched: number;
  source: 'CUSTOM' | 'GLOBAL';
  tiers: Array<{
    minCredits: number;
    pricePerCreditCents: number;
  }>;
};

export const matchBulkRateTier = ({
  credits,
  tiers,
}: {
  credits: number;
  tiers: ResellerBulkRateTierLike[];
}): { minCredits: number; pricePerCreditCents: number } | null => {
  const enabled = tiers
    .filter((tier) => tier.isEnabled && tier.minCredits > 0 && tier.pricePerCreditCents > 0)
    .sort((a, b) => a.minCredits - b.minCredits);

  if (enabled.length === 0) {
    return null;
  }

  const matching = [...enabled].reverse().find((tier) => credits >= tier.minCredits);

  if (!matching) {
    return null;
  }

  return {
    minCredits: matching.minCredits,
    pricePerCreditCents: matching.pricePerCreditCents,
  };
};

export const getGlobalResellerBulkRateTiers = async () => {
  return prisma.resellerBulkRateTier.findMany({
    orderBy: { minCredits: 'asc' },
  });
};

export const getResellerProfileBulkRateTiers = async (resellerProfileId: string) => {
  return prisma.resellerProfileBulkRateTier.findMany({
    where: { resellerProfileId },
    orderBy: { minCredits: 'asc' },
  });
};

export const resolveResellerBulkRate = async ({
  organisationId,
  credits,
}: {
  organisationId: string;
  credits: number;
}): Promise<ResolvedResellerBulkRate> => {
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'Credits must be a positive whole number',
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    select: {
      id: true,
      status: true,
      bulkRatesUseCustom: true,
      bulkRateTiers: {
        orderBy: { minCredits: 'asc' },
      },
    },
  });

  if (!profile || profile.status !== 'ACTIVE') {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Only active resellers can buy bulk inventory',
    });
  }

  const customEnabled =
    profile.bulkRatesUseCustom && profile.bulkRateTiers.some((tier) => tier.isEnabled);

  const sourceTiers = customEnabled
    ? profile.bulkRateTiers
    : await getGlobalResellerBulkRateTiers();

  const matched = matchBulkRateTier({ credits, tiers: sourceTiers });

  if (!matched) {
    const minRequired = sourceTiers
      .filter((tier) => tier.isEnabled)
      .sort((a, b) => a.minCredits - b.minCredits)[0]?.minCredits;

    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: minRequired
        ? `Minimum bulk purchase is ${minRequired} credits`
        : 'Bulk rates are not configured yet',
    });
  }

  return {
    credits,
    ratePerCreditCents: matched.pricePerCreditCents,
    amountInCents: credits * matched.pricePerCreditCents,
    minCreditsMatched: matched.minCredits,
    source: customEnabled ? 'CUSTOM' : 'GLOBAL',
    tiers: sourceTiers
      .filter((tier) => tier.isEnabled)
      .map((tier) => ({
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
      })),
  };
};

export const getEffectiveResellerBulkRatesForOrganisation = async (organisationId: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    select: {
      id: true,
      status: true,
      bulkRatesUseCustom: true,
      bulkRateTiers: {
        where: { isEnabled: true },
        orderBy: { minCredits: 'asc' },
        select: {
          minCredits: true,
          pricePerCreditCents: true,
        },
      },
    },
  });

  if (!profile || profile.status !== 'ACTIVE') {
    return null;
  }

  const useCustom = profile.bulkRatesUseCustom && profile.bulkRateTiers.length > 0;

  const tiers = useCustom
    ? profile.bulkRateTiers
    : (
        await prisma.resellerBulkRateTier.findMany({
          where: { isEnabled: true },
          orderBy: { minCredits: 'asc' },
          select: {
            minCredits: true,
            pricePerCreditCents: true,
          },
        })
      );

  return {
    resellerProfileId: profile.id,
    source: useCustom ? ('CUSTOM' as const) : ('GLOBAL' as const),
    tiers,
  };
};
