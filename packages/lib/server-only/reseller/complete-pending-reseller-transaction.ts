import {
  ResellerCreditTransactionStatus,
  ResellerProfileStatus,
} from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { resolveResellerPurchaseInvoiceId } from '@documenso/lib/server-only/billing/record-organisation-credit-purchase';
import { sendPurchaseInvoiceEmail } from '@documenso/lib/server-only/billing/send-purchase-invoice-email';
import { prisma } from '@documenso/prisma';

import {
  atomicIncrementOrganisationCredits,
  tryAtomicDecrementOrganisationCredits,
} from './reseller-credit-transfer';

export type CompletePendingResellerTransactionOptions = {
  organisationId: string;
  transactionId: string;
};

export const completePendingResellerTransaction = async ({
  organisationId,
  transactionId,
}: CompletePendingResellerTransactionOptions) => {
  const profile = await prisma.resellerProfile.findUnique({
    where: { organisationId },
    include: {
      organisation: {
        select: {
          ownerUserId: true,
        },
      },
    },
  });

  if (!profile || profile.status !== ResellerProfileStatus.ACTIVE) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Reseller profile not found',
    });
  }

  const completedTransaction = await prisma.$transaction(async (tx) => {
    const transaction = await tx.resellerCreditTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction || transaction.resellerProfileId !== profile.id) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Transaction not found',
      });
    }

    if (transaction.status !== ResellerCreditTransactionStatus.PENDING) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Transaction is not pending manual transfer',
      });
    }

    const purchaserOrganisation = await tx.organisation.findUniqueOrThrow({
      where: { id: transaction.purchaserOrganisationId },
      select: { ownerUserId: true },
    });

    const hasTransferredCredits = await tryAtomicDecrementOrganisationCredits(tx, {
      organisationId: profile.organisationId,
      ownerUserId: profile.organisation.ownerUserId,
      amount: transaction.credits,
      allowNegative: profile.allowNegativeCredits,
    });

    if (!hasTransferredCredits) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'Insufficient credits to complete this transfer',
      });
    }

    await atomicIncrementOrganisationCredits(tx, {
      organisationId: transaction.purchaserOrganisationId,
      ownerUserId: purchaserOrganisation.ownerUserId,
      amount: transaction.credits,
    });

    return tx.resellerCreditTransaction.update({
      where: { id: transaction.id },
      data: {
        status: ResellerCreditTransactionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
  });

  await sendPurchaseInvoiceEmail({
    organisationId: completedTransaction.purchaserOrganisationId,
    purchaseGroupId: completedTransaction.purchaseGroupId,
    invoiceId: resolveResellerPurchaseInvoiceId({
      transactionId: completedTransaction.id,
      purchaseGroupId: completedTransaction.purchaseGroupId,
    }),
    recipientEmail: completedTransaction.purchaserEmail,
    recipientName: completedTransaction.purchaserName,
  }).catch((error) => {
    console.error('[RESELLER]: Failed to send purchase invoice email after manual transfer', error);
  });

  return completedTransaction;
};
