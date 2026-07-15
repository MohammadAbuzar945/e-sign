import { ResellerProfileStatus } from '@prisma/client';

import { getOrganisationCredits } from '@documenso/ee/server-only/limits/user-credits';
import { RESELLER_DELINQUENCY_DAYS } from '@documenso/lib/constants/reseller-attribution';
import { prisma } from '@documenso/prisma';

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
    if (profile.zeroBalanceSince || profile.isDelinquent) {
      await prisma.resellerProfile.update({
        where: { id: profile.id },
        data: {
          zeroBalanceSince: null,
          // Restock clears delinquency so consenting customers can use sticky billing again.
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

  const daysZero =
    (now.getTime() - zeroBalanceSince.getTime()) / (1000 * 60 * 60 * 24);

  if (daysZero < RESELLER_DELINQUENCY_DAYS) {
    return prisma.resellerProfile.findUnique({ where: { id: profile.id } });
  }

  await prisma.$transaction(async (tx) => {
    await tx.resellerProfile.update({
      where: { id: profile.id },
      data: {
        isDelinquent: true,
        delinquentAt: now,
      },
    });

    // Keep association link but require explicit customer reconsent before sticky billing (§12.3 / §12.5).
    await tx.organisation.updateMany({
      where: { associatedResellerProfileId: profile.id },
      data: {
        resellerRequiresReconsent: true,
      },
    });
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
