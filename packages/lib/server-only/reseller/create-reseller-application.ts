import { Prisma, ResellerApplicationStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { getOrganisationResellerMetrics } from './get-reseller-eligibility';
import { getResellerEligibility } from './get-reseller-eligibility';
import { sendResellerApplicationAdminNotification } from './send-reseller-application-admin-notification';

export type CreateResellerApplicationOptions = {
  organisationId: string;
  applicantUserId: number;
  applicantUserEmail: string;
  variableValues?: Record<string, string>;
};

export const createResellerApplication = async ({
  organisationId,
  applicantUserId,
  applicantUserEmail,
  variableValues,
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

  const termsVariableValues =
    variableValues && Object.keys(variableValues).length > 0
      ? (variableValues as Prisma.InputJsonValue)
      : Prisma.DbNull;

  const applicationData = {
    applicantUserId,
    status: ResellerApplicationStatus.PENDING,
    appliedAt: new Date(),
    termsSentAt: null,
    termsCompletedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    snapshotOrgName: organisation.name,
    snapshotApplicantName: applicant.name ?? applicant.email,
    snapshotApplicantEmail: applicant.email,
    snapshotCompletedDocCount: metrics.creditsConsumed,
    snapshotUniqueSignerCount: metrics.uniqueSignerCount,
    snapshotOrgUserCount: metrics.orgUserCount,
    snapshotOrgSignupDate: organisation.createdAt,
    termsTemplateId: null,
    termsEnvelopeId: null,
    externalDocGenRequestId: null,
    termsVariableValues,
  };

  const existingApplication = await prisma.resellerApplication.findUnique({
    where: { organisationId },
  });

  const canReapplyExistingApplication =
    existingApplication &&
    (existingApplication.status === ResellerApplicationStatus.REJECTED ||
      existingApplication.status === ResellerApplicationStatus.CANCELLED);

  const application = canReapplyExistingApplication
    ? await prisma.resellerApplication.update({
        where: { id: existingApplication.id },
        data: applicationData,
      })
    : await prisma.resellerApplication.create({
        data: {
          organisationId,
          ...applicationData,
        },
      });

  await sendResellerApplicationAdminNotification({
    applicationId: application.id,
    organisationName: application.snapshotOrgName,
    applicantName: application.snapshotApplicantName,
    applicantEmail: application.snapshotApplicantEmail,
    completedDocumentCount: application.snapshotCompletedDocCount,
    uniqueSignerCount: application.snapshotUniqueSignerCount,
    organisationUserCount: application.snapshotOrgUserCount,
    organisationSignupDate: application.snapshotOrgSignupDate,
  });

  return application;
};
