import {
  ResellerApplicationStatus,
  ResellerCreditTransactionStatus,
  ResellerProfileStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

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
      message: 'This reseller profile is already active.',
    });
  }

  return await prisma.resellerProfile.update({
    where: { id: profile.id },
    data: {
      status: ResellerProfileStatus.ACTIVE,
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

  await prisma.$transaction(async (tx) => {
    await tx.resellerProfile.delete({
      where: { id: profile.id },
    });

    await tx.resellerApplication.delete({
      where: { id: applicationId },
    });
  });

  return { success: true as const };
};
