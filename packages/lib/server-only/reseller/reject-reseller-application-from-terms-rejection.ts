import { ResellerApplicationStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import {
  buildResellerApplicationTermsCompletionWhere,
  type ActivateResellerFromTermsCompletionOptions,
} from './activate-reseller-from-terms-completion';

export const RESELLER_TERMS_REJECTION_PREFIX = 'Rejected by reseller';

export type RejectResellerApplicationFromTermsRejectionOptions =
  ActivateResellerFromTermsCompletionOptions & {
    rejectionReason?: string;
  };

export const formatResellerTermsRejectionReason = (rejectionReason?: string) => {
  const trimmedReason = rejectionReason?.trim();

  if (trimmedReason) {
    return `${RESELLER_TERMS_REJECTION_PREFIX}: ${trimmedReason}`;
  }

  return RESELLER_TERMS_REJECTION_PREFIX;
};

export const isResellerTermsRejectionReason = (rejectionReason?: string | null) => {
  return rejectionReason?.startsWith(RESELLER_TERMS_REJECTION_PREFIX) ?? false;
};

export const getResellerApplicationStatusLabel = (
  status: string,
  rejectionReason?: string | null,
) => {
  if (status === 'REJECTED' && isResellerTermsRejectionReason(rejectionReason)) {
    return 'Rejected by reseller';
  }

  return status;
};

export const rejectResellerApplicationFromTermsRejection = async ({
  envelopeId,
  envelopeExternalId,
  envelopeSecondaryId,
  rejectionReason,
}: RejectResellerApplicationFromTermsRejectionOptions) => {
  const application = await prisma.resellerApplication.findFirst({
    where: buildResellerApplicationTermsCompletionWhere({
      envelopeId,
      envelopeExternalId,
      envelopeSecondaryId,
    }),
  });

  if (!application) {
    return null;
  }

  return await prisma.resellerApplication.update({
    where: { id: application.id },
    data: {
      status: ResellerApplicationStatus.REJECTED,
      rejectedAt: new Date(),
      rejectionReason: formatResellerTermsRejectionReason(rejectionReason),
    },
  });
};
