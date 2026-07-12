import { OrganisationCreditPurchaseStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

export type CreatePendingOrganisationCreditPurchaseOptions = {
  paystackReference: string;
  organisationId: string;
  userId: number;
  credits: number;
  grossAmount: number;
  currency?: string;
};

export type CompleteOrganisationCreditPurchaseOptions = {
  paystackReference: string;
  organisationId: string;
  userId: number;
  credits: number;
  grossAmount: number;
  currency?: string;
};

export const createPendingOrganisationCreditPurchase = async ({
  paystackReference,
  organisationId,
  userId,
  credits,
  grossAmount,
  currency = 'ZAR',
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
      status: OrganisationCreditPurchaseStatus.PENDING,
    },
    update: {
      organisationId,
      userId,
      credits,
      grossAmount,
      currency,
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
}: CompleteOrganisationCreditPurchaseOptions) => {
  const existingPurchase = await prisma.organisationCreditPurchase.findUnique({
    where: {
      paystackReference,
    },
  });

  if (existingPurchase?.status === OrganisationCreditPurchaseStatus.COMPLETED) {
    return existingPurchase;
  }

  const completedAt = new Date();

  if (existingPurchase) {
    return await prisma.organisationCreditPurchase.update({
      where: {
        id: existingPurchase.id,
      },
      data: {
        organisationId,
        userId,
        credits,
        grossAmount,
        currency,
        status: OrganisationCreditPurchaseStatus.COMPLETED,
        completedAt,
      },
    });
  }

  return await prisma.organisationCreditPurchase.create({
    data: {
      paystackReference,
      organisationId,
      userId,
      credits,
      grossAmount,
      currency,
      status: OrganisationCreditPurchaseStatus.COMPLETED,
      completedAt,
    },
  });
};
