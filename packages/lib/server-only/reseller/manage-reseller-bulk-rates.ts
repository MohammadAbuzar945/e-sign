import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

export type BulkRateTierInput = {
  minCredits: number;
  pricePerCreditCents: number;
  isEnabled?: boolean;
};

const validateBulkRateTiers = (tiers: BulkRateTierInput[]) => {
  if (tiers.length === 0) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'At least one bulk rate tier is required',
    });
  }

  const seen = new Set<number>();

  for (const tier of tiers) {
    if (!Number.isInteger(tier.minCredits) || tier.minCredits <= 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Each tier minCredits must be a positive whole number',
      });
    }

    if (!Number.isInteger(tier.pricePerCreditCents) || tier.pricePerCreditCents <= 0) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: 'Each tier pricePerCreditCents must be a positive whole number',
      });
    }

    if (seen.has(tier.minCredits)) {
      throw new AppError(AppErrorCode.INVALID_BODY, {
        message: `Duplicate minCredits tier: ${tier.minCredits}`,
      });
    }

    seen.add(tier.minCredits);
  }

  if (!tiers.some((tier) => tier.isEnabled !== false)) {
    throw new AppError(AppErrorCode.INVALID_BODY, {
      message: 'At least one enabled bulk rate tier is required',
    });
  }
};

export const replaceGlobalResellerBulkRateTiers = async (tiers: BulkRateTierInput[]) => {
  validateBulkRateTiers(tiers);

  await prisma.$transaction(async (tx) => {
    await tx.resellerBulkRateTier.deleteMany({});
    await tx.resellerBulkRateTier.createMany({
      data: tiers.map((tier) => ({
        minCredits: tier.minCredits,
        pricePerCreditCents: tier.pricePerCreditCents,
        isEnabled: tier.isEnabled !== false,
      })),
    });
  });

  return prisma.resellerBulkRateTier.findMany({
    orderBy: { minCredits: 'asc' },
  });
};

export const replaceResellerProfileBulkRateTiers = async ({
  resellerProfileId,
  bulkRatesUseCustom,
  tiers,
}: {
  resellerProfileId: string;
  bulkRatesUseCustom: boolean;
  tiers: BulkRateTierInput[];
}) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { id: resellerProfileId },
    select: { id: true },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, { message: 'Reseller not found' });
  }

  if (bulkRatesUseCustom) {
    validateBulkRateTiers(tiers);
  }

  await prisma.$transaction(async (tx) => {
    await tx.resellerProfile.update({
      where: { id: resellerProfileId },
      data: { bulkRatesUseCustom },
    });

    await tx.resellerProfileBulkRateTier.deleteMany({
      where: { resellerProfileId },
    });

    if (bulkRatesUseCustom && tiers.length > 0) {
      await tx.resellerProfileBulkRateTier.createMany({
        data: tiers.map((tier) => ({
          resellerProfileId,
          minCredits: tier.minCredits,
          pricePerCreditCents: tier.pricePerCreditCents,
          isEnabled: tier.isEnabled !== false,
        })),
      });
    }
  });

  return {
    bulkRatesUseCustom,
    tiers: await prisma.resellerProfileBulkRateTier.findMany({
      where: { resellerProfileId },
      orderBy: { minCredits: 'asc' },
    }),
  };
};
