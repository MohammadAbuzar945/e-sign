import { ResellerCreditTransactionStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { getOrganisationPurchaseInvoice } from './organisation-purchase-invoice';

const RESELLER_SALE_INVOICE_STATUSES: ResellerCreditTransactionStatus[] = [
  ResellerCreditTransactionStatus.COMPLETED,
  ResellerCreditTransactionStatus.PENDING,
];

/**
 * Resolve a reseller-issued purchase invoice for the selling organisation.
 * Invoice IDs are `reseller_{transactionId}` and live on the purchaser org ledger.
 */
export const getResellerSaleInvoice = async ({
  resellerOrganisationId,
  invoiceId,
}: {
  resellerOrganisationId: string;
  invoiceId: string;
}) => {
  if (!invoiceId.startsWith('reseller_')) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invoice not found',
    });
  }

  const transactionId = invoiceId.slice('reseller_'.length);

  const transaction = await prisma.resellerCreditTransaction.findFirst({
    where: {
      id: transactionId,
      resellerOrganisationId,
      status: { in: RESELLER_SALE_INVOICE_STATUSES },
    },
    select: {
      purchaserOrganisationId: true,
      purchaserName: true,
      purchaserEmail: true,
    },
  });

  if (!transaction) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invoice not found',
    });
  }

  const result = await getOrganisationPurchaseInvoice({
    organisationId: transaction.purchaserOrganisationId,
    invoiceId,
  });

  return {
    ...result,
    purchaserName: transaction.purchaserName,
    purchaserEmail: transaction.purchaserEmail,
  };
};
