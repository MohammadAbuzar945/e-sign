import { ResellerApplicationStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { getOrganisationResellerMetrics } from './get-reseller-eligibility';
import { getResellerEligibility } from './get-reseller-eligibility';

export type CreateResellerApplicationOptions = {
  organisationId: string;
  applicantUserId: number;
  applicantUserEmail: string;
};

export const createResellerApplication = async ({
  organisationId,
  applicantUserId,
  applicantUserEmail,
}: CreateResellerApplicationOptions) => {
  const eligibility = await getResellerEligibility({
    organisationId,
    userEmail: applicantUserEmail,
  });

  if (!eligibility.isEligible) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: eligibility.reasons[0] ?? 'Organisation is not eligible to apply as a reseller.',
    });
  }

  const [organisation, applicant] = await Promise.all([
    prisma.organisation.findUniqueOrThrow({
      where: { id: organisationId },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: applicantUserId },
    }),
  ]);

  const metrics = await getOrganisationResellerMetrics(organisationId);

  return await prisma.resellerApplication.create({
    data: {
      organisationId,
      applicantUserId,
      status: ResellerApplicationStatus.PENDING,
      snapshotOrgName: organisation.name,
      snapshotApplicantName: applicant.name ?? applicant.email,
      snapshotApplicantEmail: applicant.email,
      snapshotCompletedDocCount: metrics.completedDocumentCount,
      snapshotUniqueSignerCount: metrics.uniqueSignerCount,
      snapshotOrgUserCount: metrics.orgUserCount,
      snapshotOrgSignupDate: organisation.createdAt,
    },
  });
};
