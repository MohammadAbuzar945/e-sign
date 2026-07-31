import { DocumentStatus, EnvelopeType, ResellerApplicationStatus } from '@prisma/client';

import { isDemoFeatureVisible } from '@documenso/lib/constants/demo-feature-flags';
import { getResellerEligibilityThresholds } from '@documenso/lib/server-only/site-settings/get-reseller-site-settings';
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
  hasSignupTenure: boolean;
  requiredSignupMonths: number;
  accountCreatedAt: Date | null;
  /** @deprecated Use hasSignupTenure */
  hasSubscriptionTenure: boolean;
  /** @deprecated Use requiredSignupMonths */
  requiredSubscriptionMonths: number;
  /** @deprecated Use accountCreatedAt */
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
  const { minCreditsUsed, minSignupMonths } = await getResellerEligibilityThresholds();

  if (!userEmail) {
    return {
      isEligible: false,
      creditsUsed: 0,
      requiredCredits: minCreditsUsed,
      hasSignupTenure: false,
      requiredSignupMonths: minSignupMonths,
      accountCreatedAt: null,
      hasSubscriptionTenure: false,
      requiredSubscriptionMonths: minSignupMonths,
      subscriptionStartDate: null,
      hasActiveApplication: false,
      hasActiveResellerProfile: false,
      application: null,
      reasons: ['You must be signed in to apply to the reseller programme.'],
    };
  }

  // Metrics still collected for UI; credits/tenure gates are bypassed when testing flag is on.
  const metrics = await getOrganisationResellerMetrics(organisationId);

  const organisation = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { createdAt: true },
  });

  const accountCreatedAt = organisation?.createdAt ?? null;
  const monthsSinceSignup = accountCreatedAt
    ? (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24 * 30)
    : 0;

  const creditsUsed = Math.max(metrics.creditsConsumed, metrics.completedDocumentCount);
  const hasCreditsRequirement = creditsUsed >= minCreditsUsed;
  const hasSignupTenure = monthsSinceSignup >= minSignupMonths;

  const [existingApplication, existingProfile] = await Promise.all([
    prisma.resellerApplication.findUnique({
      where: { organisationId },
    }),
    prisma.resellerProfile.findUnique({
      where: { organisationId },
    }),
  ]);

  const hasBlockingResellerProfile = Boolean(existingProfile);

  // RESELLER_ELIGIBILITY_BYPASS opens credits/tenure checks for all (testing).
  const hasEligibilityBypass = isDemoFeatureVisible('RESELLER_ELIGIBILITY_BYPASS');

  const reasons: string[] = [];

  if (!hasCreditsRequirement && !hasEligibilityBypass) {
    reasons.push(
      `You must have used at least ${minCreditsUsed} e-sign credits before applying.`,
    );
  }

  if (!hasSignupTenure && !hasEligibilityBypass) {
    reasons.push(
      `Your organisation must have been signed up for at least ${minSignupMonths} months.`,
    );
  }

  if (!hasBlockingResellerProfile) {
    if (existingApplication && !['REJECTED', 'CANCELLED'].includes(existingApplication.status)) {
      reasons.push('An application is already in progress for this organisation.');
    }
  }

  const meetsRequirements = hasEligibilityBypass || (hasCreditsRequirement && hasSignupTenure);

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
    isEligible: meetsRequirements && reasons.length === 0 && !hasBlockingResellerProfile,
    creditsUsed,
    requiredCredits: minCreditsUsed,
    hasSignupTenure,
    requiredSignupMonths: minSignupMonths,
    accountCreatedAt,
    hasSubscriptionTenure: hasSignupTenure,
    requiredSubscriptionMonths: minSignupMonths,
    subscriptionStartDate: accountCreatedAt,
    hasActiveApplication: Boolean(
      existingApplication && !['REJECTED', 'CANCELLED'].includes(existingApplication.status),
    ),
    hasActiveResellerProfile: hasBlockingResellerProfile,
    application: applicationSummary,
    reasons,
  };
};
