import { jobs } from '@documenso/lib/jobs/client';
import { prisma } from '@documenso/prisma';

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
        lastError: null,
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

  let remainingCredits = Math.max(creditsRecord?.credits ?? 0, 0);

  for (const pendingDocument of pendingDocuments) {
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
