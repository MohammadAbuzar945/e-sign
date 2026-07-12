import { DocumentStatus, EnvelopeType, ResellerApplicationStatus, SubscriptionStatus } from '@prisma/client';

import {
  isResellerFeatureAllowedEmail,
  RESELLER_MIN_CREDITS_USED,
  RESELLER_MIN_SUBSCRIPTION_MONTHS,
} from '@documenso/lib/constants/esign-credit-packages';
import { RESELLER_FEATURE_ACCESS_DENIED_MESSAGE } from '@documenso/lib/utils/reseller-feature-access';
import { prisma } from '@documenso/prisma';

export type OrganisationResellerMetrics = {
  completedDocumentCount: number;
  uniqueSignerCount: number;
  orgUserCount: number;
  creditsConsumed: number;
};

export const getOrganisationResellerMetrics = async (
  organisationId: string,
): Promise<OrganisationResellerMetrics> => {
  const [completedDocumentCount, uniqueSignerResult, orgUserCount, teams] = await Promise.all([
    prisma.envelope.count({
      where: {
        type: EnvelopeType.DOCUMENT,
        status: DocumentStatus.COMPLETED,
        deletedAt: null,
        team: {
          organisationId,
        },
      },
    }),
    prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(DISTINCT LOWER(r.email)) as count
      FROM "Recipient" r
      INNER JOIN "Envelope" e ON e.id = r."envelopeId"
      INNER JOIN "Team" t ON t.id = e."teamId"
      WHERE t."organisationId" = ${organisationId}
        AND e.type = 'DOCUMENT'
        AND e.status = 'COMPLETED'
        AND e."deletedAt" IS NULL
    `,
    prisma.organisationMember.count({
      where: { organisationId },
    }),
    prisma.team.findMany({
      where: { organisationId },
      select: { creditConsumed: true },
    }),
  ]);

  const uniqueSignerCount = Number(uniqueSignerResult[0]?.count ?? 0);
  const creditsConsumed = teams.reduce((sum, team) => sum + team.creditConsumed, 0);

  return {
    completedDocumentCount,
    uniqueSignerCount,
    orgUserCount,
    creditsConsumed,
  };
};

export type ResellerApplicationSummary = {
  status: ResellerApplicationStatus;
  appliedAt: Date;
  termsSentAt: Date | null;
  termsCompletedAt: Date | null;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
};

export type ResellerEligibility = {
  isEligible: boolean;
  creditsUsed: number;
  requiredCredits: number;
  hasSubscriptionTenure: boolean;
  requiredSubscriptionMonths: number;
  subscriptionStartDate: Date | null;
  hasActiveApplication: boolean;
  hasActiveResellerProfile: boolean;
  application: ResellerApplicationSummary | null;
  reasons: string[];
};

export const getResellerEligibility = async ({
  organisationId,
  userEmail,
}: {
  organisationId: string;
  userEmail?: string;
}): Promise<ResellerEligibility> => {
  if (!userEmail || !isResellerFeatureAllowedEmail(userEmail)) {
    return {
      isEligible: false,
      creditsUsed: 0,
      requiredCredits: RESELLER_MIN_CREDITS_USED,
      hasSubscriptionTenure: false,
      requiredSubscriptionMonths: RESELLER_MIN_SUBSCRIPTION_MONTHS,
      subscriptionStartDate: null,
      hasActiveApplication: false,
      hasActiveResellerProfile: false,
      application: null,
      reasons: [RESELLER_FEATURE_ACCESS_DENIED_MESSAGE],
    };
  }

  const metrics = await getOrganisationResellerMetrics(organisationId);

  const subscription = await prisma.subscription.findFirst({
    where: {
      organisationId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.INACTIVE, SubscriptionStatus.PAST_DUE],
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  const subscriptionStartDate = subscription?.createdAt ?? null;
  const monthsSinceSubscription = subscriptionStartDate
    ? (Date.now() - subscriptionStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 0;

  const creditsUsed = Math.max(metrics.creditsConsumed, metrics.completedDocumentCount);
  const hasCreditsRequirement = creditsUsed >= RESELLER_MIN_CREDITS_USED;
  const hasSubscriptionTenure = monthsSinceSubscription >= RESELLER_MIN_SUBSCRIPTION_MONTHS;

  const [existingApplication, existingProfile] = await Promise.all([
    prisma.resellerApplication.findUnique({
      where: { organisationId },
    }),
    prisma.resellerProfile.findUnique({
      where: { organisationId },
    }),
  ]);

  const hasEligibilityBypass = isResellerFeatureAllowedEmail(userEmail);

  const reasons: string[] = [];

  if (!hasCreditsRequirement && !hasEligibilityBypass) {
    reasons.push(
      `You must have used at least ${RESELLER_MIN_CREDITS_USED} e-sign credits before applying.`,
    );
  }

  if (!hasSubscriptionTenure && !hasEligibilityBypass) {
    reasons.push(
      `You must have been a subscriber for at least ${RESELLER_MIN_SUBSCRIPTION_MONTHS} months.`,
    );
  }

  if (existingApplication && !['REJECTED', 'CANCELLED'].includes(existingApplication.status)) {
    reasons.push('An application is already in progress for this organisation.');
  }

  if (existingProfile) {
    reasons.push('This organisation is already an active reseller.');
  }

  const meetsRequirements =
    hasEligibilityBypass || (hasCreditsRequirement && hasSubscriptionTenure);

  const applicationSummary: ResellerApplicationSummary | null = existingApplication
    ? {
        status: existingApplication.status,
        appliedAt: existingApplication.appliedAt,
        termsSentAt: existingApplication.termsSentAt,
        termsCompletedAt: existingApplication.termsCompletedAt,
        approvedAt: existingApplication.approvedAt,
        rejectedAt: existingApplication.rejectedAt,
        rejectionReason: existingApplication.rejectionReason,
      }
    : null;

  return {
    isEligible: meetsRequirements && reasons.length === 0,
    creditsUsed,
    requiredCredits: RESELLER_MIN_CREDITS_USED,
    hasSubscriptionTenure,
    requiredSubscriptionMonths: RESELLER_MIN_SUBSCRIPTION_MONTHS,
    subscriptionStartDate,
    hasActiveApplication: Boolean(
      existingApplication && !['REJECTED', 'CANCELLED'].includes(existingApplication.status),
    ),
    hasActiveResellerProfile: Boolean(existingProfile),
    application: applicationSummary,
    reasons,
  };
};
