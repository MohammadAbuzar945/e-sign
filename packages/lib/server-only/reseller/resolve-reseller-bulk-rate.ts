import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  matchBulkRateTier,
  mergeBulkRateTiers,
  type ResellerBulkRateTierLike,
} from '@documenso/lib/utils/reseller-bulk-rate';
import { prisma } from '@documenso/prisma';

export type { ResellerBulkRateTierLike };
export { matchBulkRateTier, mergeBulkRateTiers };

export type ResellerBulkRateSource = 'CUSTOM' | 'GLOBAL' | 'MERGED';

export type ResolvedResellerBulkRate = {
  credits: number;
  ratePerCreditCents: number;
  amountInCents: number;
  minCreditsMatched: number;
  source: ResellerBulkRateSource;
  tiers: Array<{
    minCredits: number;
    pricePerCreditCents: number;
  }>;
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

const toTierForDisplay = (tiers: ResellerBulkRateTierLike[]) =>
  tiers
    .filter((tier) => tier.isEnabled)
    .map((tier) => ({
      minCredits: tier.minCredits,
      pricePerCreditCents: tier.pricePerCreditCents,
    }));

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
      bulkRatesIncludeGlobal: true,
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

  let source: ResellerBulkRateSource = 'GLOBAL';
  let sourceTiers: ResellerBulkRateTierLike[];

  if (!customEnabled) {
    sourceTiers = await getGlobalResellerBulkRateTiers();
  } else if (profile.bulkRatesIncludeGlobal) {
    const globalTiers = await getGlobalResellerBulkRateTiers();
    sourceTiers = mergeBulkRateTiers({
      customTiers: profile.bulkRateTiers,
      globalTiers,
    });
    source = 'MERGED';
  } else {
    sourceTiers = profile.bulkRateTiers;
    source = 'CUSTOM';
  }

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
    source,
    tiers: toTierForDisplay(sourceTiers),
  };
};

export const getEffectiveResellerBulkRatesForOrganisation = async (organisationId: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    select: {
      id: true,
      status: true,
      bulkRatesUseCustom: true,
      bulkRatesIncludeGlobal: true,
      bulkRateTiers: {
        where: { isEnabled: true },
        orderBy: { minCredits: 'asc' },
        select: {
          minCredits: true,
          pricePerCreditCents: true,
          isEnabled: true,
        },
      },
    },
  });

  if (!profile || profile.status !== 'ACTIVE') {
    return null;
  }

  const useCustom = profile.bulkRatesUseCustom && profile.bulkRateTiers.length > 0;
  const globalTiers = await prisma.resellerBulkRateTier.findMany({
    where: { isEnabled: true },
    orderBy: { minCredits: 'asc' },
    select: {
      minCredits: true,
      pricePerCreditCents: true,
      isEnabled: true,
    },
  });

  if (!useCustom) {
    return {
      resellerProfileId: profile.id,
      source: 'GLOBAL' as const,
      tiers: toTierForDisplay(globalTiers),
    };
  }

  if (profile.bulkRatesIncludeGlobal) {
    const merged = mergeBulkRateTiers({
      customTiers: profile.bulkRateTiers,
      globalTiers,
    });

    return {
      resellerProfileId: profile.id,
      source: 'MERGED' as const,
      tiers: toTierForDisplay(merged),
    };
  }

  return {
    resellerProfileId: profile.id,
    source: 'CUSTOM' as const,
    tiers: toTierForDisplay(profile.bulkRateTiers),
  };
};
