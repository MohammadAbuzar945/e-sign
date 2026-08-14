import { ResellerCreditTransactionStatus } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import {
  mapResellerTransactionToHistoryItem,
  resolveBuyerBillingAddressForOrganisation,
  resolveBuyerVatNumberForOrganisation,
} from './get-organisation-purchase-history';
import { resolveResellerInvoiceLogoDataUrl } from './organisation-purchase-invoice';

const RESELLER_SALE_INVOICE_STATUSES: ResellerCreditTransactionStatus[] = [
  ResellerCreditTransactionStatus.COMPLETED,
  ResellerCreditTransactionStatus.PENDING,
];

/**
 * Resolve a reseller-issued sale invoice for the selling organisation.
 * Built from the transaction snapshot so a deleted buyer org cannot break download.
 */
export const getResellerSaleInvoice = async ({
  resellerOrganisationId,
  resellerProfileId,
  invoiceId,
}: {
  resellerOrganisationId: string;
  resellerProfileId?: string | null;
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
      status: { in: RESELLER_SALE_INVOICE_STATUSES },
      OR: [
        { resellerOrganisationId },
        ...(resellerProfileId ? [{ resellerProfileId }] : []),
      ],
    },
    select: {
      id: true,
      createdAt: true,
      completedAt: true,
      credits: true,
      grossAmount: true,
      currency: true,
      status: true,
      paystackReference: true,
      purchaseGroupId: true,
      invoiceNumber: true,
      purchaserOrganisationId: true,
      purchaserName: true,
      purchaserEmail: true,
      purchaserOrganisationName: true,
      sellerDisplayName: true,
      sellerPhysicalAddress: true,
      sellerAffiliateSlug: true,
      sellerVatStatus: true,
      sellerVatNumber: true,
      package: {
        select: {
          creditAmount: true,
          catalogPackageId: true,
        },
      },
      resellerProfile: {
        select: {
          affiliateSlug: true,
          brandingEnabled: true,
          brandingLogo: true,
          brandingCompanyDetails: true,
          physicalAddress: true,
          vatStatus: true,
          vatNumber: true,
          organisation: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!transaction) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Invoice not found',
    });
  }

  const [buyerVatNumber, buyerBillingAddress] = await Promise.all([
    resolveBuyerVatNumberForOrganisation(transaction.purchaserOrganisationId).catch(() => null),
    resolveBuyerBillingAddressForOrganisation(transaction.purchaserOrganisationId).catch(
      () => null,
    ),
  ]);

  const invoice = mapResellerTransactionToHistoryItem({
    transaction,
    buyerVatNumber,
    buyerBillingAddress,
  });

  const resellerLogoUrl =
    invoice.resellerSeller?.hasLogo && invoice.resellerSeller.affiliateSlug
      ? await resolveResellerInvoiceLogoDataUrl(invoice.resellerSeller.affiliateSlug)
      : null;

  return {
    invoice,
    organisation: {
      name: transaction.purchaserOrganisationName,
      url: '',
      owner: {
        name: transaction.purchaserName,
        email: transaction.purchaserEmail,
      },
    },
    resellerLogoUrl,
    purchaserName: transaction.purchaserName,
    purchaserEmail: transaction.purchaserEmail,
  };
};
