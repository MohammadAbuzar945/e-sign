import { DocumentStatus, EnvelopeType, ResellerApplicationStatus } from '@prisma/client';
import type { Prisma } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { activateResellerFromTermsCompletion } from './activate-reseller-from-terms-completion';

const buildCompletedEnvelopeWhere = ({
  applicationId,
  termsEnvelopeId,
  externalDocGenRequestId,
}: {
  applicationId: string;
  termsEnvelopeId: string | null;
  externalDocGenRequestId: string | null;
}): Prisma.EnvelopeWhereInput => {
  const orConditions: Prisma.EnvelopeWhereInput[] = [{ externalId: applicationId }];

  if (termsEnvelopeId) {
    orConditions.push({ id: termsEnvelopeId }, { externalId: termsEnvelopeId });
  }

  if (externalDocGenRequestId) {
    orConditions.push(
      { id: externalDocGenRequestId },
      { externalId: externalDocGenRequestId },
    );
  }

  return {
    type: EnvelopeType.DOCUMENT,
    status: DocumentStatus.COMPLETED,
    OR: orConditions,
  };
};

export const retryResellerApplicationActivation = async ({
  applicationId,
}: {
  applicationId: string;
}) => {
  const application = await prisma.resellerApplication.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller application not found.',
    });
  }

  if (
    application.status !== ResellerApplicationStatus.TERMS_SENT &&
    application.status !== ResellerApplicationStatus.TERMS_COMPLETED
  ) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Only applications with sent terms can be activated.',
    });
  }

  const envelope = await prisma.envelope.findFirst({
    where: buildCompletedEnvelopeWhere({
      applicationId: application.id,
      termsEnvelopeId: application.termsEnvelopeId,
      externalDocGenRequestId: application.externalDocGenRequestId,
    }),
    orderBy: {
      updatedAt: 'desc',
    },
  });

  if (!envelope) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'No completed reseller terms document was found for this application.',
    });
  }

  const profile = await activateResellerFromTermsCompletion({
    envelopeId: envelope.id,
    envelopeExternalId: envelope.externalId,
    envelopeSecondaryId: envelope.secondaryId,
  });

  if (!profile) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Unable to activate reseller from the completed document.',
    });
  }

  return { success: true as const };
};
