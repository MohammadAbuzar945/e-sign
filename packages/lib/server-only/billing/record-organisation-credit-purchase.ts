import { OrganisationCreditPurchaseStatus, OrganisationCreditPurchaseType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { allocateNomiaInvoiceNumber } from './allocate-invoice-number';

export type CreatePendingOrganisationCreditPurchaseOptions = {
  paystackReference: string;
  organisationId: string;
  userId: number;
  credits: number;
  grossAmount: number;
  currency?: string;
  purchaseGroupId?: string;
  purchaseType?: OrganisationCreditPurchaseType;
};

export type CompleteOrganisationCreditPurchaseOptions = {
  paystackReference: string;
  organisationId: string;
  userId: number;
  credits: number;
  grossAmount: number;
  currency?: string;
  purchaseGroupId?: string;
  purchaseType?: OrganisationCreditPurchaseType;
};

export type CompleteOrganisationCreditPurchaseResult = {
  purchase: {
    id: string;
    paystackReference: string;
    organisationId: string;
    userId: number;
    credits: number;
    grossAmount: number;
    currency: string;
    purchaseGroupId: string | null;
    purchaseType: OrganisationCreditPurchaseType;
    status: OrganisationCreditPurchaseStatus;
    invoiceNumber: string | null;
  };
  isNewlyCompleted: boolean;
};

export const createPendingOrganisationCreditPurchase = async ({
  paystackReference,
  organisationId,
  userId,
  credits,
  grossAmount,
  currency = 'ZAR',
  purchaseGroupId,
  purchaseType = OrganisationCreditPurchaseType.PAYG,
}: CreatePendingOrganisationCreditPurchaseOptions) => {
  return await prisma.organisationCreditPurchase.upsert({
    where: {
      paystackReference,
    },
    create: {
      paystackReference,
      organisationId,
      userId,
      credits,
      grossAmount,
      currency,
      purchaseGroupId,
      purchaseType,
      status: OrganisationCreditPurchaseStatus.PENDING,
    },
    update: {
      organisationId,
      userId,
      credits,
      grossAmount,
      currency,
      purchaseGroupId,
      purchaseType,
      status: OrganisationCreditPurchaseStatus.PENDING,
      completedAt: null,
      invoiceNumber: null,
    },
  });
};

export const completeOrganisationCreditPurchase = async ({
  paystackReference,
  organisationId,
  userId,
  credits,
  grossAmount,
  currency = 'ZAR',
  purchaseGroupId,
  purchaseType,
}: CompleteOrganisationCreditPurchaseOptions): Promise<CompleteOrganisationCreditPurchaseResult> => {
  const existingPurchase = await prisma.organisationCreditPurchase.findUnique({
    where: {
      paystackReference,
    },
  });

  if (existingPurchase?.status === OrganisationCreditPurchaseStatus.COMPLETED) {
    return {
      purchase: existingPurchase,
      isNewlyCompleted: false,
    };
  }

  const completedAt = new Date();
  const resolvedPurchaseType =
    purchaseType ?? existingPurchase?.purchaseType ?? OrganisationCreditPurchaseType.PAYG;

  const purchase = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await allocateNomiaInvoiceNumber({
      issuedAt: completedAt,
      tx,
    });

    if (existingPurchase) {
      return await tx.organisationCreditPurchase.update({
        where: {
          id: existingPurchase.id,
        },
        data: {
          organisationId,
          userId,
          credits,
          grossAmount,
          currency,
          purchaseGroupId: purchaseGroupId ?? existingPurchase.purchaseGroupId,
          purchaseType: resolvedPurchaseType,
          status: OrganisationCreditPurchaseStatus.COMPLETED,
          completedAt,
          invoiceNumber,
        },
      });
    }

    return await tx.organisationCreditPurchase.create({
      data: {
        paystackReference,
        organisationId,
        userId,
        credits,
        grossAmount,
        currency,
        purchaseGroupId,
        purchaseType: resolvedPurchaseType,
        status: OrganisationCreditPurchaseStatus.COMPLETED,
        completedAt,
        invoiceNumber,
      },
    });
  });

  return {
    purchase,
    isNewlyCompleted: true,
  };
};

export const resolveNomiaPurchaseInvoiceId = ({
  purchaseId,
}: {
  purchaseId: string;
  /** @deprecated Ignored — Nomia and reseller legs always get separate invoice IDs. */
  purchaseGroupId?: string | null;
}) => `nomia_${purchaseId}`;

export const resolveResellerPurchaseInvoiceId = ({
  transactionId,
}: {
  transactionId: string;
  /** @deprecated Ignored — Nomia and reseller legs always get separate invoice IDs. */
  purchaseGroupId?: string | null;
}) => `reseller_${transactionId}`;
