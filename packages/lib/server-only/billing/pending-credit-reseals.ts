import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';

const RETRYABLE_PENDING_CREDIT_RESEAL_ERROR_PATTERNS = [
  'Insufficient credits to seal document',
  'Task exceeded retries',
] as const;

export const isRetryablePendingCreditResealError = (errorMessage: string) =>
  RETRYABLE_PENDING_CREDIT_RESEAL_ERROR_PATTERNS.some((pattern) =>
    errorMessage.includes(pattern),
  );

export const isEligibleForPendingCreditResealRetry = (lastError: string | null) =>
  lastError === null || isRetryablePendingCreditResealError(lastError);

type UpsertPendingCreditResealOptions = {
  organisationId: string;
  teamId: number;
  documentId: number;
  creditsRequired: number;
  lastError?: string | null;
};

export const upsertPendingCreditReseal = ({
  organisationId,
  teamId,
  documentId,
  creditsRequired,
  lastError = null,
}: UpsertPendingCreditResealOptions) => {
  return prisma.pendingCreditReseal.upsert({
    where: {
      documentId,
    },
    create: {
      organisationId,
      teamId,
      documentId,
      creditsRequired,
      lastError,
    },
    update: {
      organisationId,
      teamId,
      creditsRequired,
      lastError,
    },
  });
};

export const clearPendingCreditReseal = (documentId: number) => {
  return prisma.pendingCreditReseal.deleteMany({
    where: {
      documentId,
    },
  });
};

export const markPendingCreditResealRetry = ({
  documentId,
  lastError,
}: {
  documentId: number;
  lastError?: string | null;
}) => {
  return prisma.pendingCreditReseal.updateMany({
    where: {
      documentId,
    },
    data: {
      lastRetriedAt: new Date(),
      lastError,
    },
  });
};

export const triggerPendingCreditResealsForOrganisation = async (organisationId: string) => {
  const [pendingDocuments, creditsRecord] = await Promise.all([
    prisma.pendingCreditReseal.findMany({
      where: {
        organisationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    }),
    prisma.userCredits.findFirst({
      where: {
        organisationId,
        isActive: true,
      },
      select: {
        credits: true,
      },
    }),
  ]);

  const eligiblePendingDocuments = pendingDocuments.filter((pendingDocument) =>
    isEligibleForPendingCreditResealRetry(pendingDocument.lastError),
  );

  let remainingCredits = Math.max(creditsRecord?.credits ?? 0, 0);

  for (const pendingDocument of eligiblePendingDocuments) {
    if (remainingCredits < pendingDocument.creditsRequired) {
      break;
    }

    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId: pendingDocument.documentId,
      },
    });

    await markPendingCreditResealRetry({
      documentId: pendingDocument.documentId,
      lastError: null,
    });

    remainingCredits -= pendingDocument.creditsRequired;
  }
};
