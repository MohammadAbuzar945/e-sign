import { OrganisationCreditPurchaseStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type CreatePendingOrganisationCreditPurchaseOptions = {
  paystackReference: string;
  organisationId: string;
  userId: number;
  credits: number;
  grossAmount: number;
  currency?: string;
  purchaseGroupId?: string;
};

export type CompleteOrganisationCreditPurchaseOptions = {
  paystackReference: string;
  organisationId: string;
  userId: number;
  credits: number;
  grossAmount: number;
  currency?: string;
  purchaseGroupId?: string;
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
    status: OrganisationCreditPurchaseStatus;
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
      status: OrganisationCreditPurchaseStatus.PENDING,
    },
    update: {
      organisationId,
      userId,
      credits,
      grossAmount,
      currency,
      purchaseGroupId,
      status: OrganisationCreditPurchaseStatus.PENDING,
      completedAt: null,
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

  if (existingPurchase) {
    const purchase = await prisma.organisationCreditPurchase.update({
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
        status: OrganisationCreditPurchaseStatus.COMPLETED,
        completedAt,
      },
    });

    return {
      purchase,
      isNewlyCompleted: true,
    };
  }

  const purchase = await prisma.organisationCreditPurchase.create({
    data: {
      paystackReference,
      organisationId,
      userId,
      credits,
      grossAmount,
      currency,
      purchaseGroupId,
      status: OrganisationCreditPurchaseStatus.COMPLETED,
      completedAt,
    },
  });

  return {
    purchase,
    isNewlyCompleted: true,
  };
};

export const resolveNomiaPurchaseInvoiceId = ({
  purchaseId,
  purchaseGroupId,
}: {
  purchaseId: string;
  purchaseGroupId?: string | null;
}) => purchaseGroupId || `nomia_${purchaseId}`;

export const resolveResellerPurchaseInvoiceId = ({
  transactionId,
  purchaseGroupId,
}: {
  transactionId: string;
  purchaseGroupId?: string | null;
}) => purchaseGroupId || `reseller_${transactionId}`;
