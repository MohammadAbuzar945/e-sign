import {
  ResellerApplicationStatus,
  ResellerCreditTransactionStatus,
  ResellerProfileStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import {
  applyResellerDelinquency,
  clearResellerDelinquency,
} from './reseller-delinquency';
import { sendResellerRejectionEmail } from './send-reseller-rejection-email';

const IN_PROGRESS_APPLICATION_STATUSES: ResellerApplicationStatus[] = [
  ResellerApplicationStatus.PENDING,
  ResellerApplicationStatus.TERMS_SENT,
  ResellerApplicationStatus.TERMS_COMPLETED,
];

const getResellerApplicationOrThrow = async (applicationId: string) => {
  const application = await prisma.resellerApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller application not found.',
    });
  }

  return application;
};

const assertApplicationInProgress = (status: ResellerApplicationStatus) => {
  if (!IN_PROGRESS_APPLICATION_STATUSES.includes(status)) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This application can no longer be rejected or cancelled.',
    });
  }
};

export const rejectResellerApplication = async ({
  applicationId,
  rejectionReason,
}: {
  applicationId: string;
  rejectionReason?: string;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  assertApplicationInProgress(application.status);

  const updatedApplication = await prisma.resellerApplication.update({
    where: { id: applicationId },
    data: {
      status: ResellerApplicationStatus.REJECTED,
      rejectedAt: new Date(),
      rejectionReason,
    },
  });

  await sendResellerRejectionEmail({
    organisationName: application.snapshotOrgName,
    applicantName: application.snapshotApplicantName,
    applicantEmail: application.snapshotApplicantEmail,
    rejectionReason,
  });

  return updatedApplication;
};

export const cancelResellerApplication = async ({
  applicationId,
  cancellationReason,
}: {
  applicationId: string;
  cancellationReason?: string;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  assertApplicationInProgress(application.status);

  return await prisma.resellerApplication.update({
    where: { id: applicationId },
    data: {
      status: ResellerApplicationStatus.CANCELLED,
      rejectedAt: new Date(),
      rejectionReason: cancellationReason,
    },
  });
};

export const deactivateResellerProfile = async ({
  applicationId,
}: {
  applicationId: string;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  if (application.status !== ResellerApplicationStatus.APPROVED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only approved reseller applications can be deactivated.',
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found.',
    });
  }

  if (profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller profile is not active.',
    });
  }

  return await prisma.resellerProfile.update({
    where: { id: profile.id },
    data: {
      status: ResellerProfileStatus.INACTIVE,
    },
  });
};

export const reactivateResellerProfile = async ({
  applicationId,
}: {
  applicationId: string;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  if (application.status !== ResellerApplicationStatus.APPROVED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only approved reseller applications can be reactivated.',
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found.',
    });
  }

  if (
    profile.status !== ResellerProfileStatus.INACTIVE &&
    profile.status !== ResellerProfileStatus.SUSPENDED
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message:
        profile.status === ('DELETED' as ResellerProfileStatus)
          ? 'Deleted resellers cannot be reactivated. Purchase history is retained for audit.'
          : 'This reseller profile is already active.',
    });
  }

  return await prisma.resellerProfile.update({
    where: { id: profile.id },
    data: {
      status: ResellerProfileStatus.ACTIVE,
    },
  });
};

export const markResellerProfileDelinquent = async ({
  applicationId,
}: {
  applicationId: string;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  if (application.status !== ResellerApplicationStatus.APPROVED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only approved reseller applications can be marked delinquent.',
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found.',
    });
  }

  if (profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only active reseller profiles can be marked delinquent.',
    });
  }

  if (profile.isDelinquent) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller is already delinquent.',
    });
  }

  await applyResellerDelinquency({
    resellerProfileId: profile.id,
    // Keep the flag stable for testing even when the reseller still has inventory.
    stampZeroBalanceSince: false,
  });

  return prisma.resellerProfile.findUniqueOrThrow({
    where: { id: profile.id },
  });
};

export const clearResellerProfileDelinquency = async ({
  applicationId,
}: {
  applicationId: string;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  if (application.status !== ResellerApplicationStatus.APPROVED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only approved reseller applications can clear delinquency.',
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found.',
    });
  }

  if (!profile.isDelinquent) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller is not delinquent.',
    });
  }

  await clearResellerDelinquency({
    resellerProfileId: profile.id,
    // Admin reset also clears buyer reconsent so the delinquency flow can be retested end-to-end.
    clearBuyerReconsent: true,
  });

  return prisma.resellerProfile.findUniqueOrThrow({
    where: { id: profile.id },
  });
};

export const updateResellerAllowNegativeCredits = async ({
  applicationId,
  allowNegativeCredits,
}: {
  applicationId: string;
  allowNegativeCredits: boolean;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  if (application.status !== ResellerApplicationStatus.APPROVED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only approved reseller applications can update negative credit settings.',
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found.',
    });
  }

  if (profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Negative credits can only be configured for active reseller profiles.',
    });
  }

  return await prisma.resellerProfile.update({
    where: { id: profile.id },
    data: {
      allowNegativeCredits,
    },
  });
};

export const deleteReseller = async ({
  applicationId,
}: {
  applicationId: string;
}) => {
  const application = await getResellerApplicationOrThrow(applicationId);

  if (application.status !== ResellerApplicationStatus.APPROVED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only approved resellers can be deleted.',
    });
  }

  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId: application.organisationId },
  });

  if (!profile) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found.',
    });
  }

  if (profile.status === ResellerProfileStatus.DELETED) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'This reseller is already deleted.',
    });
  }

  const pendingTransactions = await prisma.resellerCreditTransaction.count({
    where: {
      resellerProfileId: profile.id,
      status: ResellerCreditTransactionStatus.PENDING,
    },
  });

  if (pendingTransactions > 0) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Cannot delete this reseller while credit purchases are still pending.',
    });
  }

  const deletedAt = new Date();
  // Free the public slug while keeping the row for purchase-history joins.
  const archivedAffiliateSlug = `deleted.${profile.id}`;

  await prisma.$transaction(async (tx) => {
    await tx.organisation.updateMany({
      where: { associatedResellerProfileId: profile.id },
      data: {
        associatedResellerProfileId: null,
        resellerAssociatedAt: null,
        resellerAssociationSource: null,
        resellerRequiresReconsent: false,
      },
    });

    await tx.resellerPackage.updateMany({
      where: { resellerProfileId: profile.id },
      data: { isEnabled: false },
    });

    await tx.resellerProfile.update({
      where: { id: profile.id },
      data: {
        status: ResellerProfileStatus.DELETED,
        deletedAt,
        affiliateSlug: archivedAffiliateSlug,
        allowNegativeCredits: false,
        isDelinquent: false,
        delinquentAt: null,
        zeroBalanceSince: null,
      },
    });

    // Allow the organisation to re-apply later while keeping sales history on the profile.
    await tx.resellerApplication.update({
      where: { id: applicationId },
      data: {
        status: ResellerApplicationStatus.CANCELLED,
        rejectionReason: 'Reseller account deleted by admin',
        rejectedAt: deletedAt,
      },
    });
  });

  return { success: true as const };
};
