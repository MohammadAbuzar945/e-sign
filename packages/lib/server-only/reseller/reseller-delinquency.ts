import { ResellerProfileStatus } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { RESELLER_DELINQUENCY_DAYS } from '@documenso/lib/constants/reseller-attribution';
import { prisma } from '@documenso/prisma';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Applies delinquency side-effects used by both the 90-day sync and admin testing.
 */
export const applyResellerDelinquency = async ({
  resellerProfileId,
  delinquentAt = new Date(),
  zeroBalanceSince,
  stampZeroBalanceSince = true,
}: {
  resellerProfileId: string;
  delinquentAt?: Date;
  /** Defaults to just past the delinquency threshold so sync keeps the flag. */
  zeroBalanceSince?: Date;
  /**
   * When false (admin force-test), leave zeroBalanceSince untouched so a reseller
   * that still has inventory credits is not immediately cleared by restock sync.
   */
  stampZeroBalanceSince?: boolean;
}) => {
  const effectiveZeroBalanceSince =
    zeroBalanceSince ??
    new Date(delinquentAt.getTime() - (RESELLER_DELINQUENCY_DAYS + 1) * MS_PER_DAY);

  await prisma.$transaction(async (tx) => {
    await tx.resellerProfile.update({
      where: { id: resellerProfileId },
      data: {
        isDelinquent: true,
        delinquentAt,
        // Admin force-tests clear zeroBalanceSince so inventory restock sync won't wipe the flag.
        zeroBalanceSince: stampZeroBalanceSince ? effectiveZeroBalanceSince : null,
      },
    });

    // Keep association link but require explicit customer reconsent before sticky billing (§12.3 / §12.5).
    await tx.organisation.updateMany({
      where: { associatedResellerProfileId: resellerProfileId },
      data: {
        resellerRequiresReconsent: true,
      },
    });
  });
};

/**
 * Clears delinquency flags. Optionally resets buyer reconsent so the full flow can be retested.
 */
export const clearResellerDelinquency = async ({
  resellerProfileId,
  clearBuyerReconsent = false,
}: {
  resellerProfileId: string;
  clearBuyerReconsent?: boolean;
}) => {
  await prisma.$transaction(async (tx) => {
    await tx.resellerProfile.update({
      where: { id: resellerProfileId },
      data: {
        isDelinquent: false,
        delinquentAt: null,
        zeroBalanceSince: null,
      },
    });

    if (clearBuyerReconsent) {
      await tx.organisation.updateMany({
        where: { associatedResellerProfileId: resellerProfileId },
        data: {
          resellerRequiresReconsent: false,
        },
      });
    }
  });
};

/**
 * Tracks continuous zero-balance windows and marks delinquency after 3 months (§12.2–12.3).
 * When a reseller becomes delinquent, clears sticky associations and requires customer reconsent (§12.5).
 */
export const syncResellerDelinquencyState = async (resellerProfileId: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { id: resellerProfileId },
    select: {
      id: true,
      organisationId: true,
      status: true,
      zeroBalanceSince: true,
      isDelinquent: true,
      delinquentAt: true,
      allowNegativeCredits: true,
    },
  });

  if (!profile || profile.status !== ResellerProfileStatus.ACTIVE) {
    return profile;
  }

  const availableCredits = await getOrganisationCredits(profile.organisationId);
  const now = new Date();

  if (availableCredits > 0) {
    // Restock after a tracked zero-balance window clears delinquency (§12).
    // Admin force-tests leave zeroBalanceSince null so the flag stays until Clear.
    if (profile.zeroBalanceSince) {
      await prisma.resellerProfile.update({
        where: { id: profile.id },
        data: {
          zeroBalanceSince: null,
          isDelinquent: false,
          delinquentAt: null,
        },
      });
    }

    return prisma.resellerProfile.findUnique({ where: { id: profile.id } });
  }

  // availableCredits <= 0
  let zeroBalanceSince = profile.zeroBalanceSince;

  if (!zeroBalanceSince) {
    const updated = await prisma.resellerProfile.update({
      where: { id: profile.id },
      data: { zeroBalanceSince: now },
    });
    zeroBalanceSince = updated.zeroBalanceSince;
  }

  if (profile.isDelinquent || !zeroBalanceSince) {
    return prisma.resellerProfile.findUnique({ where: { id: profile.id } });
  }

  const daysZero = (now.getTime() - zeroBalanceSince.getTime()) / MS_PER_DAY;

  if (daysZero < RESELLER_DELINQUENCY_DAYS) {
    return prisma.resellerProfile.findUnique({ where: { id: profile.id } });
  }

  await applyResellerDelinquency({
    resellerProfileId: profile.id,
    delinquentAt: now,
    zeroBalanceSince,
  });

  return prisma.resellerProfile.findUnique({ where: { id: profile.id } });
};

export const markResellerCreditsBalanceChanged = async (resellerOrganisationId: string) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId: resellerOrganisationId },
    select: { id: true },
  });

  if (!profile) {
    return;
  }

  await syncResellerDelinquencyState(profile.id);
};
