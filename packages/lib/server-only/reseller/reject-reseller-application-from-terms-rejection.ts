import { ResellerApplicationStatus } from '@prisma/client';

import {
  formatResellerTermsRejectionReason,
  RESELLER_TERMS_REJECTION_PREFIX,
} from '@documenso/lib/constants/reseller-application-status';
import { prisma } from '@documenso/prisma';

import {
  buildResellerApplicationTermsCompletionWhere,
  type ActivateResellerFromTermsCompletionOptions,
} from './activate-reseller-from-terms-completion';

export {
  formatResellerTermsRejectionReason,
  getResellerApplicationStatusLabel,
  isResellerTermsRejectionReason,
  RESELLER_TERMS_REJECTION_PREFIX,
} from '@documenso/lib/constants/reseller-application-status';

export type RejectResellerApplicationFromTermsRejectionOptions =
  ActivateResellerFromTermsCompletionOptions & {
    rejectionReason?: string;
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
